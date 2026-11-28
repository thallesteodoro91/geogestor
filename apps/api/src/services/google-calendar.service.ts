import { google } from 'googleapis';
import { db } from '../db';
import { schema } from '@geogestor/database';
import { eq } from 'drizzle-orm';
import { CalendarSyncEngine } from './calendar-sync-engine';
import { LocalSecretService } from './local-secret.service';


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
        }).where(eq(schema.configuracoes.id, configs[0].id)).execute().catch(() => {
          console.error('Não foi possível persistir a renovação OAuth. Detalhes sensíveis omitidos.');
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

  public static async engine() {
    if (!await this.isSyncEnabled()) throw new Error('Sincronização da Google Agenda está desativada.');
    const auth = await this.getOAuth2Client();
    const calendarId = process.env.GEOGESTOR_GOOGLE_CALENDAR_ID || 'primary';
    const calendar = google.calendar({ version: 'v3', auth });
    const options = { timeout: 30_000, retry: false };
    return new CalendarSyncEngine({
      get: async (id) => {
        try { return (await calendar.events.get({ calendarId, eventId: id }, options)).data; }
        catch (error) {
          const status = Number((error as { code?: unknown; response?: { status?: unknown } }).response?.status || (error as { code?: unknown }).code);
          if ([404, 410].includes(status)) return null;
          throw new Error('Não foi possível consultar o evento remoto. Verifique a conexão e a autorização Google.');
        }
      },
      list: async (pageToken) => (await calendar.events.list({ calendarId, pageToken, maxResults: 250, showDeleted: true, singleEvents: false }, options)).data,
      insert: async (body) => (await calendar.events.insert({ calendarId, requestBody: body, sendUpdates: 'none' }, options)).data,
      patch: async (id, body, etag) => (await calendar.events.patch({ calendarId, eventId: id, requestBody: body, sendUpdates: 'none' }, { ...options, headers: { 'If-Match': etag } })).data,
      delete: async (id, etag) => { await calendar.events.delete({ calendarId, eventId: id, sendUpdates: 'none' }, { ...options, headers: { 'If-Match': etag } }); }
    }, calendarId);
  }

  public static async sync(): Promise<{ sent: number; received: number }> {
    return (await this.engine()).sync();
  }
}
