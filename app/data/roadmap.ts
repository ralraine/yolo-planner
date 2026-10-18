/**
 * YOLO ROADMAP — Edit this file to announce new features.
 * This is public, read-only site content: no user data, credentials, or backend required.
 * Statuses: planned | exploring. Only add "building" when work has genuinely started.
 * Never put estimated release dates here unless you intend to honor them.
 */

export type RoadmapStatus = "planned" | "exploring" | "building";
export type FeatureIcon = "subtasks" | "friends" | "notebook" | "exam" | "insights" | "study" | "templates";

export type RoadmapFeature = {
  id: string;
  title: string;
  description: string;
  status: RoadmapStatus;
  icon: FeatureIcon;
  featured?: boolean;
  highlights: string[];
};

export type RoadmapRelease = {
  version: string;
  title: string;
  description: string;
};

export const ROADMAP_FEATURES: RoadmapFeature[] = [
  {
    id: "subtasks",
    title: "Subtasks for Every Task",
    description: "Big assignment? Split it into smaller, checkable steps and watch your progress grow.",
    status: "planned",
    icon: "subtasks",
    featured: true,
    highlights: ["Checklist inside each task", "Finished / total step progress", "Keep everything under its parent task"],
  },
  {
    id: "friends",
    title: "YOLO Friends & Messaging",
    description: "Connect with other YOLO users, send friend requests, and have your own conversations.",
    status: "planned",
    icon: "friends",
    featured: true,
    highlights: ["Find and add other YOLO users", "Friend requests and approvals", "Private conversations with privacy controls"],
  },
  {
    id: "notebooks",
    title: "Subject Notebooks",
    description: "A little home for your class notes, organized neatly by subject instead of mixed with tasks.",
    status: "planned",
    icon: "notebook",
    featured: true,
    highlights: ["Separate notes per subject", "Headings, lists, and formatting", "Find notes when reviewing for exams"],
  },
  {
    id: "exams",
    title: "Exam Countdown",
    description: "Know how close your quizzes and exams are, without having to count the days yourself.",
    status: "exploring",
    icon: "exam",
    highlights: ["Days-until-exam countdown", "Link exams to subjects", "Optional review milestones"],
  },
  {
    id: "analytics",
    title: "Study Insights by Subject",
    description: "See where your focus time goes and celebrate steady progress, one subject at a time.",
    status: "exploring",
    icon: "insights",
    highlights: ["Focus minutes by subject", "Weekly study patterns", "Pomodoro-powered summaries"],
  },
  {
    id: "study-rooms",
    title: "Shared Study Sessions",
    description: "A virtual focus room where friends can study together, even from different places.",
    status: "exploring",
    icon: "study",
    highlights: ["Join a shared focus room", "Optional synchronized work and break times", "See who's studying without sharing private tasks"],
  },
  {
    id: "templates",
    title: "Task Templates",
    description: "Start recurring school workflows faster with ready-made structures you can customize.",
    status: "exploring",
    icon: "templates",
    highlights: ["Research-paper checklist", "Project submission checklist", "Your own reusable templates"],
  },
];

export const ROADMAP_RELEASES: RoadmapRelease[] = [
  {
    version: "V6.1",
    title: "YOLO Goes Online",
    description: "Username + 4-digit PIN experience, production deployment updates, and safer login handling.",
  },
  {
    version: "V5.9",
    title: "Focus Grand Prix: Pit Wall",
    description: "Pomodoro racing dashboard with focus statistics and a seven-day study-time chart.",
  },
  {
    version: "V5.8",
    title: "Spotify & Racing Pomodoro",
    description: "Dashboard playlist player, floating vinyl music controls, and the F1-inspired focus race.",
  },
];
