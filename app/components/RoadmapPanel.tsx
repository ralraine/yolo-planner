"use client";

import { useState } from "react";
import {
  ArrowRight, BarChart3, BookOpenText, CalendarClock, CheckCircle2,
  ChevronDown, ChevronUp, ClipboardList, Flag, ListChecks,
  MessagesSquare, Rocket, Sparkles, Timer, UsersRound,
  type LucideIcon,
} from "lucide-react";
import {
  ROADMAP_FEATURES, ROADMAP_RELEASES,
  type FeatureIcon, type RoadmapStatus,
} from "../data/roadmap";

type Filter = "all" | RoadmapStatus;

const ICONS: Record<FeatureIcon, LucideIcon> = {
  subtasks: ListChecks,
  friends: MessagesSquare,
  notebook: BookOpenText,
  exam: CalendarClock,
  insights: BarChart3,
  study: UsersRound,
  templates: ClipboardList,
};

const LABELS: Record<RoadmapStatus, string> = {
  planned: "Planned",
  exploring: "Exploring",
  building: "In Development",
};

const TABS: { id: Filter; label: string }[] = [
  { id: "all", label: "All ideas" },
  { id: "planned", label: "Planned" },
  { id: "building", label: "In Development" },
  { id: "exploring", label: "Exploring" },
];

export default function RoadmapPanel() {
  const [filter, setFilter] = useState<Filter>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const visible = ROADMAP_FEATURES.filter((feature) => filter === "all" || feature.status === filter);
  const featured = visible.filter((feature) => feature.featured);
  const other = visible.filter((feature) => !feature.featured);

  function cards(items: typeof ROADMAP_FEATURES) {
    return items.map((feature) => {
      const Icon = ICONS[feature.icon];
      const isOpen = expanded === feature.id;
      return (
        <article className={`yolo62-feature-card ${feature.featured ? "is-featured" : ""}`} key={feature.id}>
          <div className="yolo62-card-top">
            <div className={`yolo62-icon yolo62-icon-${feature.icon}`}><Icon size={22} aria-hidden="true" /></div>
            <span className={`yolo62-status is-${feature.status}`}><span />{LABELS[feature.status]}</span>
          </div>
          <h3>{feature.title}</h3>
          <p>{feature.description}</p>
          <button
            className="yolo62-more"
            type="button"
            aria-expanded={isOpen}
            aria-controls={`yolo62-details-${feature.id}`}
            onClick={() => setExpanded(isOpen ? null : feature.id)}
          >
            {isOpen ? "Hide the idea" : "Take a closer look"}
            {isOpen ? <ChevronUp size={15} aria-hidden="true" /> : <ChevronDown size={15} aria-hidden="true" />}
          </button>
          {isOpen && (
            <div className="yolo62-card-details" id={`yolo62-details-${feature.id}`}>
              {feature.highlights.map((highlight) => <div key={highlight}><CheckCircle2 size={14} aria-hidden="true" /><span>{highlight}</span></div>)}
            </div>
          )}
        </article>
      );
    });
  }

  return (
    <div className="yolo62-page">
      <section className="yolo62-intro db-panel" aria-label="YOLO roadmap introduction">
        <div className="yolo62-intro-content">
          <div className="yolo62-eyebrow"><Sparkles size={15} aria-hidden="true" /> A LITTLE PEEK INTO TOMORROW</div>
          <h2>Good things are <span>coming to YOLO.</span></h2>
          <p>More ways to plan, study, and stay connected. Here&apos;s what we&apos;re dreaming up for your favorite little workspace.</p>
          <div className="yolo62-intro-footer"><Rocket size={16} aria-hidden="true" /><span>Made for students. Growing one idea at a time.</span></div>
        </div>
        <div className="yolo62-orbit" aria-hidden="true">
          <div className="yolo62-orbit-ring ring-outer" />
          <div className="yolo62-orbit-ring ring-inner" />
          <div className="yolo62-orbit-planet"><Rocket size={51} strokeWidth={1.8}/></div>
          <span className="yolo62-orbit-star star-one">✦</span>
          <span className="yolo62-orbit-star star-two">✧</span>
          <span className="yolo62-orbit-star star-three">✦</span>
        </div>
      </section>

      <section className="yolo62-section" aria-labelledby="yolo62-roadmap-heading">
        <div className="yolo62-section-heading">
          <div><span className="db-overline">THE ROAD AHEAD</span><h2 id="yolo62-roadmap-heading">On our wishlist <span>✿</span></h2><p>Some are planned; others are ideas we&apos;re still exploring.</p></div>
          <div className="yolo62-idea-count"><Flag size={16}/>{ROADMAP_FEATURES.length} ideas</div>
        </div>
        <div className="yolo62-tabs" role="group" aria-label="Filter roadmap features">
          {TABS.map((tab) => <button
            key={tab.id}
            type="button"
            className={filter === tab.id ? "active" : ""}
            aria-pressed={filter === tab.id}
            onClick={() => { setFilter(tab.id); setExpanded(null); }}
          >{tab.label}</button>)}
        </div>
        {featured.length > 0 && <>
          <div className="yolo62-group-title"><span>TOP OF OUR LIST</span><span className="yolo62-group-rule"/></div>
          <div className="yolo62-feature-grid">{cards(featured)}</div>
        </>}
        {other.length > 0 && <>
          <div className="yolo62-group-title"><span>MORE IDEAS TO EXPLORE</span><span className="yolo62-group-rule"/></div>
          <div className="yolo62-feature-grid">{cards(other)}</div>
        </>}
        {visible.length === 0 && <div className="yolo62-empty db-panel"><Timer size={24}/><strong>Nothing here just yet.</strong><p>We&apos;ll update this section when an idea moves to this stage.</p><button type="button" onClick={() => setFilter("all")}>See all ideas <ArrowRight size={15}/></button></div>}
        <p className="yolo62-disclaimer">These are ideas, not promised launch dates. Plans may change as YOLO grows.</p>
      </section>

      <section className="yolo62-changelog db-panel" aria-labelledby="yolo62-changelog-heading">
        <div className="yolo62-section-heading">
          <div><span className="db-overline">THE LITTLE WINS</span><h2 id="yolo62-changelog-heading">Recently shipped <span>✦</span></h2><p>A few things we&apos;ve already brought to YOLO.</p></div>
          <div className="yolo62-release-icon"><CheckCircle2 size={22}/></div>
        </div>
        <div className="yolo62-release-list">
          {ROADMAP_RELEASES.map((release, i) => <div className="yolo62-release" key={release.version}>
            <div className="yolo62-timeline-mark"><span className={i === 0 ? "latest" : ""}/></div>
            <div><span className="yolo62-release-version">{release.version}{i === 0 && <em>Latest</em>}</span><h3>{release.title}</h3><p>{release.description}</p></div>
          </div>)}
        </div>
      </section>
      <div className="yolo62-signoff"><Sparkles size={15} aria-hidden="true"/> Thanks for growing with YOLO! <Sparkles size={15} aria-hidden="true"/></div>
    </div>
  );
}
