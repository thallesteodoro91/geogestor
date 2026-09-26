import { google } from 'googleapis';
import { db } from '../db';
import { schema } from '@geogestor/database';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { LocalSecretService } from './local-secret.service';
import { buildGoogleCalendarEvent, googleEventStartToLocal } from './google-calendar-mapping';

const getErrorStatus = (err: unknown) => {
  const value = err as { code?: unknown; status?: unknown };
  return value.code ?? value.status;
};

const getErrorMessage = (err: unknown) => (
  err instanceof Error ? err.message : String(err)
);

export class GoogleCalendarService {
  public static async isSyncEnabled() {
    const [config] = await db.select({
      active: schema.configuracoes.googleSyncActive,
      refreshToken: schema.configuracoes.googleRefreshToken
    }).from(schema.configuracoes).limit(1);
    return Boolean(config?.active && config.refreshToken);
  }

  private static async getOAuth2Client() {
    const configs = await db.select().from(schema.configuracoes).limit(1);
    if (!configs[0] || !configs[0].googleClientId || !configs[0].googleClientSecret) {
      throw new Error('Chaves de API do Google Calendar não configuradas no GeoGestor.');
    }

    const googleClientId = configs[0].googleClientId;
    const googleClientSecret = LocalSecretService.reveal(configs[0].googleClientSecret);
    if (!googleClientSecret) throw new Error('Segredo do Google Calendar indisponível.');

    // O loopback OAuth aceita redirecionamento dinâmico local.
    // Usaremos a própria API do GeoGestor para interceptar o callback se necessário, ou localhost genérico.
    // No caso de "App para Computador" (Desktop), podemos rodar na porta da API.
    // Vamos obter a porta da API dinamicamente ou usar localhost (o google permite 127.0.0.1 em portas dinâmicas)
    const port = process.env.PORT || '3001';
    const redirectUri = `http://127.0.0.1:${port}/api/google/callback`;

    const oauth2Client = new google.auth.OAuth2(
      googleClientId,
      googleClientSecret,
      redirectUri
    );

    const googleRefreshToken = LocalSecretService.reveal(configs[0].googleRefreshToken);
    const googleAccessToken = LocalSecretService.reveal(configs[0].googleAccessToken);
    if (googleRefreshToken) {
      oauth2Client.setCredentials({
        refresh_token: googleRefreshToken,
        access_token: googleAccessToken || undefined
      });
    }

    // Listener nativo para salvar token renovado automaticamente
    oauth2Client.on('tokens', (tokens) => {
      if (tokens.access_token) {
        db.update(schema.configuracoes).set({
          googleAccessToken: LocalSecretService.protect(tokens.access_token),
          googleRefreshToken: LocalSecretService.protect(tokens.refresh_token || googleRefreshToken),
          updatedAt: new Date().toISOString()
        }).where(eq(schema.configuracoes.id, configs[0].id)).execute().catch(err => {
          console.error('Erro ao atualizar token OAuth no banco:', err);
        });
      }
    });

    return oauth2Client;
  }

  // Gera a URL de login do Google
  public static async getAuthUrl(state: string): Promise<string> {
    const oauth2Client = await this.getOAuth2Client();
    return oauth2Client.generateAuthUrl({
      access_type: 'offline', // Importante para receber o refresh_token
      scope: ['https://www.googleapis.com/auth/calendar'],
      prompt: 'consent', // Garante que retorne o refresh_token sempre
      state
    });
  }

  // Finaliza a autenticação com o código enviado pelo callback
  public static async authenticate(code: string): Promise<void> {
    const oauth2Client = await this.getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const configs = await db.select().from(schema.configuracoes).limit(1);
    if (configs[0]) {
      await db.update(schema.configuracoes).set({
        googleAccessToken: LocalSecretService.protect(tokens.access_token || null),
        googleRefreshToken: LocalSecretService.protect(tokens.refresh_token || LocalSecretService.reveal(configs[0].googleRefreshToken)),
        googleSyncActive: true,
        updatedAt: new Date().toISOString()
      }).where(eq(schema.configuracoes.id, configs[0].id));
    }
  }

  // Sincroniza compromissos Locais -> Google Calendar E Google -> Local (Bidirecional)
  public static async sync(): Promise<{ sent: number; received: number }> {
    if (!await this.isSyncEnabled()) {
      throw new Error('Sincronização da Google Agenda está desativada.');
    }
    const oauth2Client = await this.getOAuth2Client();
    
    // Verifica se os tokens de fato existem
    const credentials = oauth2Client.credentials;
    if (!credentials.refresh_token) {
      throw new Error('Google Agenda não autenticado ou sem token de refresh.');
    }

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    // 1. Sincronia: Local -> Google
    // Pegar compromissos que ainda não têm googleEventId ou foram modificados
    const compromissosLocais = await db.select().from(schema.compromissos);
    let sent = 0;
    let failures = 0;

    for (const comp of compromissosLocais) {
      try {
        const eventData = buildGoogleCalendarEvent(comp);

        if (comp.googleEventId) {
          // Evento já existe no Google, vamos atualizar
          try {
            await calendar.events.update({
              calendarId: 'primary',
              eventId: comp.googleEventId,
              requestBody: eventData
            });
            await db.update(schema.compromissos).set({
              ultimoSyncGoogle: new Date().toISOString()
            }).where(eq(schema.compromissos.id, comp.id));
          } catch (updateErr) {
            // Se o evento foi deletado no Google, o update lança 404. Recriamos.
            if (getErrorStatus(updateErr) === 404) {
              const response = await calendar.events.insert({
                calendarId: 'primary',
                requestBody: eventData
              });
              if (response.data.id) {
                await db.update(schema.compromissos).set({
                  googleEventId: response.data.id,
                  ultimoSyncGoogle: new Date().toISOString()
                }).where(eq(schema.compromissos.id, comp.id));
                sent++;
              }
            } else {
              throw updateErr;
            }
          }
        } else {
          // Evento novo, insere no Google
          const response = await calendar.events.insert({
            calendarId: 'primary',
            requestBody: eventData
          });

          if (response.data.id) {
            await db.update(schema.compromissos).set({
              googleEventId: response.data.id,
              ultimoSyncGoogle: new Date().toISOString()
            }).where(eq(schema.compromissos.id, comp.id));
            sent++;
          }
        }
      } catch (err) {
        failures += 1;
        console.error(`Erro ao sincronizar compromisso local ${comp.id} para Google:`, getErrorMessage(err));
      }
    }

    // 2. Sincronia: Google -> Local
    let received = 0;
    try {
      const now = new Date();
      const minDate = new Date();
      minDate.setMonth(now.getMonth() - 2); // Sincroniza eventos dos últimos 2 meses

      let pageToken: string | undefined = undefined;
      const googleEvents: any[] = [];

      // Paginação para evitar perder eventos quando a agenda for grande
      do {
        const response = await calendar.events.list({
          calendarId: 'primary',
          timeMin: minDate.toISOString(),
          singleEvents: true,
          orderBy: 'startTime',
          maxResults: 250,
          pageToken
        }) as { data: { items?: any[]; nextPageToken?: string | null } };
        if (response.data.items) {
          googleEvents.push(...response.data.items);
        }
        pageToken = response.data.nextPageToken || undefined;
      } while (pageToken);

      for (const event of googleEvents) {
        if (!event.id) continue;

        // Espelhamento total: remove filtro GeoGestor, captura qualquer evento do Google Agenda
        const cleanTitle = event.summary 
          ? event.summary.replace('[GeoGestor] ', '') 
          : 'Sem Título (Google Agenda)';

        const localStart = googleEventStartToLocal(event.start);
        if (!localStart) continue;

        // Checar se já existe no banco local via googleEventId
        const localExistente = await db.select().from(schema.compromissos)
          .where(eq(schema.compromissos.googleEventId, event.id)).limit(1);

        if (localExistente.length > 0) {
          // Já existe, atualiza localmente caso o título/data/descrição mudaram
          if (
            localExistente[0].titulo !== cleanTitle ||
            localExistente[0].data !== localStart.data ||
            localExistente[0].hora !== localStart.hora ||
            localExistente[0].descricao !== (event.description || '')
          ) {
            await db.update(schema.compromissos).set({
              titulo: cleanTitle,
              data: localStart.data,
              hora: localStart.hora,
              descricao: event.description || '',
              ultimoSyncGoogle: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }).where(eq(schema.compromissos.id, localExistente[0].id));
            received++;
          }
        } else {
          // Evento novo vindo do Google, cria no GeoGestor local
          await db.insert(schema.compromissos).values({
            id: crypto.randomUUID(),
            titulo: cleanTitle,
            descricao: event.description || '',
            data: localStart.data,
            hora: localStart.hora,
            tipo: 'Outro',
            googleEventId: event.id,
            ultimoSyncGoogle: new Date().toISOString()
          });
          received++;
        }
      }
    } catch (err) {
      failures += 1;
      console.error('Erro ao sincronizar compromissos do Google para o local:', getErrorMessage(err));
    }

    if (failures > 0) {
      throw new Error(`Sincronização parcial: ${failures} etapa(s) falharam; enviados=${sent}; recebidos=${received}. Tente novamente.`);
    }
    return { sent, received };
  }
}
