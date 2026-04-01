import { useState, useMemo, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Search, BookOpen, ExternalLink } from "lucide-react";
import { helpCategories, type HelpCategory, type HelpSection } from "@/data/help-center-data";
import { HelpTopicCard } from "@/components/ajuda/HelpTopicCard";
import { HelpFeedback } from "@/components/ajuda/HelpFeedback";

const Ajuda = () => {
  const [search, setSearch] = useState("");
  const [openSections, setOpenSections] = useState<string[]>([]);

  const scrollToSection = useCallback((sectionId: string) => {
    setOpenSections((prev) =>
      prev.includes(sectionId) ? prev : [...prev, sectionId]
    );
    setTimeout(() => {
      const el = document.getElementById(`section-${sectionId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 150);
  }, []);

  const { filteredCategories, totalResults } = useMemo(() => {
    if (!search.trim()) return { filteredCategories: helpCategories, totalResults: 0 };
    const q = search.toLowerCase();
    let count = 0;

    const filtered = helpCategories
      .map((cat) => {
        const filteredSections = cat.sections
          .map((section) => {
            const matchesSection =
              section.title.toLowerCase().includes(q) ||
              section.description.toLowerCase().includes(q);

            const filteredTopics = section.topics.filter(
              (t) =>
                t.title.toLowerCase().includes(q) ||
                t.description.toLowerCase().includes(q) ||
                t.steps?.some((s) => s.toLowerCase().includes(q)) ||
                t.tips?.some((s) => s.toLowerCase().includes(q)) ||
                t.warnings?.some((s) => s.toLowerCase().includes(q)) ||
                t.commonErrors?.some((s) => s.toLowerCase().includes(q))
            );

            if (matchesSection) {
              count += section.topics.length;
              return section;
            }
            if (filteredTopics.length > 0) {
              count += filteredTopics.length;
              return { ...section, topics: filteredTopics };
            }
            return null;
          })
          .filter(Boolean) as HelpSection[];

        if (filteredSections.length === 0) return null;
        return { ...cat, sections: filteredSections };
      })
      .filter(Boolean) as HelpCategory[];

    return { filteredCategories: filtered, totalResults: count };
  }, [search]);

  // Collect all section IDs for related links
  const allSectionsMap = useMemo(() => {
    const map = new Map<string, { title: string; categoryTitle: string }>();
    helpCategories.forEach((cat) =>
      cat.sections.forEach((s) => map.set(s.id, { title: s.title, categoryTitle: cat.title }))
    );
    return map;
  }, []);

  return (
    <AppLayout>
      <div className="container mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <BookOpen className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Central de Ajuda</h1>
          </div>
          <p className="text-muted-foreground">
            Guia completo do GeoGestor. Encontre respostas rápidas para qualquer funcionalidade.
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por funcionalidade, dúvida ou recurso..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {search.trim() && totalResults > 0 && (
          <p className="text-sm text-muted-foreground">
            {totalResults} {totalResults === 1 ? "resultado encontrado" : "resultados encontrados"} para "{search}"
          </p>
        )}

        {/* Content */}
        {filteredCategories.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                Nenhum resultado encontrado para "{search}". Tente termos diferentes.
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredCategories.map((category) => (
            <div key={category.id} className="space-y-3">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <span>{category.emoji}</span>
                {category.title}
              </h2>

              <Accordion type="multiple" value={openSections} onValueChange={setOpenSections} className="space-y-2">
                {category.sections.map((section) => (
                  <AccordionItem
                    key={section.id}
                    value={section.id}
                    id={`section-${section.id}`}
                    className="border rounded-lg px-4 bg-card"
                  >
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-3">
                        <section.icon className="h-5 w-5 text-primary shrink-0" />
                        <div className="text-left">
                          <span className="font-semibold">{section.title}</span>
                          <p className="text-sm text-muted-foreground font-normal">
                            {section.description}
                          </p>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4">
                        {section.image && (
                          <img
                            src={section.image}
                            alt={`Tela de ${section.title}`}
                            className="w-full max-w-3xl rounded-lg shadow-md border border-border"
                            loading="lazy"
                          />
                        )}

                        <div className="space-y-4">
                          {section.topics.map((topic) => (
                            <HelpTopicCard
                              key={topic.id}
                              topic={topic}
                              searchQuery={search.trim()}
                            />
                          ))}
                        </div>

                        {/* Related sections */}
                        {section.relatedSections && section.relatedSections.length > 0 && (
                          <div className="pt-2 border-t border-border/40">
                            <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                              <ExternalLink className="h-3 w-3" /> Artigos relacionados:
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {section.relatedSections.map((relId) => {
                                const related = allSectionsMap.get(relId);
                                if (!related) return null;
                                return (
                                  <Badge
                                    key={relId}
                                    variant="secondary"
                                    className="text-xs font-normal cursor-pointer hover:bg-primary/20 transition-colors"
                                    onClick={() => scrollToSection(relId)}
                                  >
                                    {related.title}
                                  </Badge>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        <HelpFeedback sectionId={section.id} />
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          ))
        )}

        {/* Footer */}
        <Card>
          <CardContent className="py-6 text-center">
            <p className="text-sm text-muted-foreground">
              Ainda com dúvidas? Use o{" "}
              <a href="/geobot" className="text-primary hover:underline font-medium">
                GeoBot
              </a>{" "}
              para tirar dúvidas em tempo real ou entre em contato pelo e-mail{" "}
              <span className="font-medium text-foreground">
                suporte@geogestor.com.br
              </span>
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Ajuda;
