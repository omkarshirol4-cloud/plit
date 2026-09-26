/**
 * SYNTHETIC DEMO DATASET — NovaHire Technologies.
 *
 * ============================ READ THIS FIRST ============================
 * Everything in this file is FICTIONAL and was written by hand for the
 * hackathon demo. It is not derived from, and does not describe, any real
 * person, employer, resume, phone number, address or biometric signal.
 *
 *   * Every name below is invented.
 *   * Every email uses a reserved, non-routable demo domain
 *     (`@demo.local` for candidates, `.demo` for the recruiter) so a stray
 *     message can never reach a real inbox. `.local` is reserved by RFC 6762
 *     for mDNS and is not a valid public TLD.
 *   * Every "verification" number in here is a hand-picked constant used to
 *     drive the demo UI. NONE of it came from a face, a voice, a camera or
 *     the verification ML service, and none of it is biometric data.
 *   * Every "screening score" in here is produced by a small deterministic
 *     demo estimator in `demo-seed.ts` — NOT by the resume-screening ML
 *     service. Those rows carry the `demo_seed_2026` namespace precisely so
 *     they can never be mistaken for real model output.
 *
 * Rule the rest of the demo code follows: never present a number from this
 * file as something a real system produced.
 * =======================================================================
 *
 * Pure data, no database import, so `db.ts` can load it without a circular
 * dependency (same rule `seed-data.ts` follows).
 */

// ---------------------------------------------------------------- namespace

/**
 * The demo marker. Every primary key the seed creates starts with this, and
 * `reset:demo` deletes exactly these rows and nothing else.
 *
 * Real rows are created by `newId()` and are therefore always
 * `cand_*`, `job_*`, `app_*`, `vs_*`, `sl_*`, `att_*`, `tok_*`, `wal_*`,
 * `cach_*` or `achv_*`. No real id can begin with `demo_`, which is what
 * makes the reset safe.
 */
export { DEMO_PREFIX, DEMO_SEED_REF, DEMO_EMAIL_DOMAIN } from "./demo-marker.ts";

// ------------------------------------------------------------------ company

export type DemoCompany = {
  name: string;
  industry: string;
  recruiterName: string;
  recruiterEmail: string;
  tagline: string;
};

export const DEMO_COMPANY: DemoCompany = {
  name: "NovaHire Technologies",
  industry: "Technology & Digital Solutions",
  recruiterName: "Aarav Mehta",
  // `.demo` is not a real TLD — this address cannot resolve or be delivered.
  recruiterEmail: "recruiter@novahire.demo",
  tagline: "SYNTHETIC DEMO EMPLOYER — fictional company, fictional roles.",
};

// --------------------------------------------------------------------- jobs

export type DemoJobSpec = {
  /** Short key used by the application matrix. */
  key: string;
  title: string;
  domain: string;
  experienceLevel: string;
  location: string;
  /** Days before "today" that the role was posted. */
  postedDaysAgo: number;
  requiredSkills: string[];
  description: string;
};

export const DEMO_JOBS: DemoJobSpec[] = [
  {
    key: "junior_data_analyst",
    title: "Junior Data Analyst",
    domain: "Data & Analytics",
    experienceLevel: "Entry level (0-1 year)",
    location: "Bengaluru, India (Hybrid)",
    postedDaysAgo: 21,
    requiredSkills: ["Python", "SQL", "Excel", "Data Analysis", "Statistics"],
    description: [
      "We are looking for a Junior Data Analyst to join our Data & Analytics team at NovaHire Technologies.",
      "You will sit with the reporting team and turn raw operational data into dashboards the business actually reads:",
      "- Build and maintain SQL queries against our warehouse and validate the numbers before they reach a slide.",
      "- Write Python scripts to clean, join and aggregate data from three source systems.",
      "- Refresh Excel models used by the commercial team and explain movement month over month.",
      "- Support descriptive Statistics work: distributions, sampling error and simple significance checks.",
      "- Document every metric definition so two people can reproduce the same number.",
      "",
      "Domain: Data & Analytics. Experience level: Entry level (0-1 year).",
      "Industry: Technology & Digital Solutions.",
      "",
      DEMO_COMPANY.tagline,
    ].join("\n"),
  },
  {
    key: "psychology_research_intern",
    title: "Psychology Research Intern",
    domain: "Psychology & Research",
    experienceLevel: "Internship (0-1 year)",
    location: "Pune, India (On-site)",
    postedDaysAgo: 18,
    requiredSkills: ["Research Methods", "Statistics", "SPSS", "Report Writing", "Psychology"],
    description: [
      "NovaHire Technologies is hiring a Psychology Research Intern to support our workplace-wellbeing research track.",
      "You will be embedded with a three-person research group and will own real deliverables from week two:",
      "- Design and pilot interview guides and questionnaire items using established Research Methods.",
      "- Recruit and screen participants against an inclusion criteria sheet.",
      "- Enter and clean data in SPSS, then run the descriptive Statistics the study protocol specifies.",
      "- Write up findings in our Report Writing template, including the limitations section.",
      "- Support literature reviews and reference management.",
      "",
      "Domain: Psychology & Research. Experience level: Internship (0-1 year).",
      "Industry: Technology & Digital Solutions.",
      "",
      DEMO_COMPANY.tagline,
    ].join("\n"),
  },
  {
    key: "uiux_design_intern",
    title: "UI/UX Design Intern",
    domain: "Design",
    experienceLevel: "Internship (0-6 months)",
    location: "Remote (India)",
    postedDaysAgo: 14,
    requiredSkills: ["Figma", "UI Design", "UX Research", "Prototyping"],
    description: [
      "We are looking for a UI/UX Design Intern to join the product design team at NovaHire Technologies.",
      "What you will do:",
      "- Turn a rough flow into clickable Prototyping in Figma within a day.",
      "- Extend and document the existing design system: components, tokens and usage rules.",
      "- Run lightweight UX Research: 5 moderated usability sessions, affinity mapping, a written readout.",
      "- Apply accessibility basics (contrast, focus order, target size) to every UI Design deliverable.",
      "- Sit in on critique and give feedback on other people's work.",
      "",
      "Domain: Design. Experience level: Internship (0-6 months).",
      "Industry: Technology & Digital Solutions.",
      "",
      DEMO_COMPANY.tagline,
    ].join("\n"),
  },
  {
    key: "hr_recruitment_intern",
    title: "HR & Recruitment Intern",
    domain: "Human Resources",
    experienceLevel: "Internship (0-1 year)",
    location: "Hyderabad, India (Hybrid)",
    postedDaysAgo: 10,
    requiredSkills: ["Communication", "Recruitment", "Interviewing", "MS Office", "HR Fundamentals"],
    description: [
      "NovaHire Technologies is hiring an HR & Recruitment Intern to support a 40-person engineering organisation.",
      "You will report to the Talent Acquisition Lead and will:",
      "- Run candidate sourcing across two job boards and keep the Recruitment tracker current.",
      "- Schedule Interview loops and send candidate communications that actually read well.",
      "- Take first-round screening calls using our structured Interviewing guides.",
      "- Keep HR Fundamentals records right: offer letters, document checklists and onboarding packs.",
      "- Maintain reports in MS Office for headcount, time-to-hire and offer-acceptance.",
      "",
      "Domain: Human Resources. Experience level: Internship (0-1 year).",
      "Industry: Technology & Digital Solutions.",
      "",
      DEMO_COMPANY.tagline,
    ].join("\n"),
  },
  {
    key: "marketing_associate",
    title: "Marketing Associate",
    domain: "Marketing",
    experienceLevel: "Associate (1-2 years)",
    location: "Mumbai, India (Hybrid)",
    postedDaysAgo: 7,
    requiredSkills: ["Digital Marketing", "Content Writing", "Communication", "Social Media", "Analytics"],
    description: [
      "We are hiring a Marketing Associate at NovaHire Technologies to run always-on acquisition for two product lines.",
      "You will:",
      "- Own the weekly Content Writing calendar: four long-form posts and eight Social Media cut-downs.",
      "- Run paid Digital Marketing campaigns end to end, from keyword research to creative test.",
      "- Report on Analytics weekly — spend, CAC, pipeline-sourced leads — and say what you will change.",
      "- Own candidate-facing Communication: event landing pages and the careers newsletter.",
      "",
      "Domain: Marketing. Experience level: Associate (1-2 years).",
      "Industry: Technology & Digital Solutions.",
      "",
      DEMO_COMPANY.tagline,
    ].join("\n"),
  },
];

// ---------------------------------------------------------------- candidates

export type DemoCandidateSpec = {
  key: string;
  name: string;
  /** Always `<key with _ and . replaced>@demo.local`. */
  email: string;
  /** Empty string means the demo candidate has not written one yet. */
  headline: string;
  skills: string[];
  education: string;
  experience: string;
  /**
   * Resume file written under `.uploads` by the seed. Null means the demo
   * candidate has not uploaded one, which is what makes their profile read as
   * incomplete.
   */
  resumeFile: string | null;
  /** The resume body. `null` when there is no file. */
  resumeText: string | null;
  /** Days before "today" that the demo candidate signed up. */
  joinedDaysAgo: number;
  /** Shown in the recruiter's applicant list. Fictional and generic. */
  note?: string;
};

const resumeHeader = (name: string, headline: string, education: string, experience: string) =>
  [
    name,
    headline,
    "",
    "EDUCATION",
    education,
    "",
    "EXPERIENCE",
    experience,
  ].join("\n");

export const DEMO_CANDIDATES: DemoCandidateSpec[] = [
  // --- A. strong match for Data & Analytics --------------------------------
  {
    key: "ananya_rao",
    name: "Ananya Rao",
    email: "ananya.rao@demo.local",
    headline: "Data Analyst | Python, SQL and statistical reporting",
    skills: ["Python", "SQL", "Excel", "Data Analysis", "Statistics", "Pandas", "Power BI", "Tableau"],
    education: "B.Sc. Statistics, University of Mysore (2023) — CGPA 8.4/10",
    experience: "Data Analyst Intern, Kaveri Analytics (6 months) — 40+ dashboard reports, automated 3 recurring weekly reports in Python, cut reporting time from 6 hours to 40 minutes.",
    resumeFile: "ananya-rao-demo-resume.txt",
    resumeText: resumeHeader(
      "ANANYA RAO",
      "Data Analyst | Python, SQL, Excel, Data Analysis, Statistics",
      "B.Sc. Statistics, University of Mysore (2023). Core coursework: inferential Statistics, regression analysis, sampling theory.",
      "Data Analyst Intern, Kaveri Analytics (Jan-Jun 2024).\n- Owned 40+ recurring reporting requests end to end for three business units.\n- Wrote Python (Pandas) ETL scripts that replaced manual Excel copy-paste for three weekly reports; reporting time fell from 6 hours to 40 minutes per cycle.\n- Wrote and tuned 120+ SQL queries against a Postgres warehouse; reduced average query runtime 60% by adding composite indexes.\n- Built a Power BI model of 9 KPIs used in the monthly commercial review; dashboard adoption reached 80% of the commercial team.\n- Documented every metric definition in a shared data dictionary.",
    ),
    joinedDaysAgo: 26,
    note: "Available immediately. Strongest Data & Analytics profile in the demo pool.",
  },
  // --- B. moderate match for Data & Analytics -------------------------------
  {
    key: "rohan_kapoor",
    name: "Rohan Kapoor",
    email: "rohan.kapoor@demo.local",
    headline: "Recent statistics graduate seeking a data analyst role",
    skills: ["Python", "SQL", "Excel", "Data Analysis", "MS Excel"],
    education: "B.Sc. Statistics, University of Delhi (2024) — CGPA 7.6/10",
    experience: "Classroom projects only — two semester Data Analysis projects, no commercial data experience yet.",
    resumeFile: "rohan-kapoor-demo-resume.txt",
    resumeText: resumeHeader(
      "ROHAN KAPOOR",
      "Recent statistics graduate seeking a data analyst role",
      "B.Sc. Statistics, University of Delhi (2024). Coursework includes Statistics and Data Analysis.",
      "Academic projects.\n- Semester project: analysed a public transport dataset in Python and presented findings to a panel.\n- Internship, two months: entered and cleaned survey data in MS Excel for a local NGO; basic SQL practice only.\nNo commercial analytics employment yet.",
    ),
    joinedDaysAgo: 18,
    note: "Strong academic background, limited commercial analytics exposure.",
  },
  // --- C. strong match for Psychology & Research ----------------------------
  {
    key: "meera_nair",
    name: "Meera Nair",
    email: "meera.nair@demo.local",
    headline: "Psychology researcher | SPSS, study design and report writing",
    skills: [
      "Research Methods",
      "Statistics",
      "SPSS",
      "Report Writing",
      "Psychology",
      "Qualitative Analysis",
      "Literature Review",
    ],
    education: "M.Sc. Psychology, NIMHANS Bangalore (2024) — dissertation on self-efficacy and shift work",
    experience: "Research Assistant, Centre for Occupational Psychology (12 months) — ran a 6-month mixed-methods study (n=214), owned participant recruitment, SPSS analysis and the final report.",
    resumeFile: "meera-nair-demo-resume.txt",
    resumeText: resumeHeader(
      "MEERA NAIR",
      "Psychology researcher | SPSS, study design and report writing",
      "M.Sc. Psychology, NIMHANS Bangalore (2024). Dissertation: self-efficacy and sleep quality in rotating-shift nurses. Trained in Research Methods, quantitative and qualitative analysis.",
      "Research Assistant, Centre for Occupational Psychology (Mar 2023 - Mar 2024).\n- Sole author of a 28-page Report Writing deliverable on a mixed-methods study of 214 participants.\n- Built the study protocol and ethics documentation; handled participant recruitment and informed consent.\n- Cleaned and analysed all quantitative data in SPSS: descriptive and inferential Statistics, t-tests and ANOVA.\n- Coded 60 open-ended responses and ran a thematic analysis alongside two senior researchers.\n- Presented findings at a departmental research seminar; findings changed the pilot's shift-roster design.",
    ),
    joinedDaysAgo: 24,
    note: "Most active demo candidate: five applications, assessment and verification complete.",
  },
  // --- D. strong UI/UX profile ---------------------------------------------
  {
    key: "arjun_shah",
    name: "Arjun Shah",
    email: "arjun.shah@demo.local",
    headline: "Product designer | Figma, design systems and UX research",
    skills: ["Figma", "UI Design", "UX Research", "Prototyping", "Wireframing", "Design Systems", "Accessibility"],
    education: "B.Des Communication Design, NID Ahmedabad (2023)",
    experience: "Product Design Intern, Kite Labs (8 months) — owned the onboarding flow and rebuilt the component library.",
    resumeFile: "arjun-shah-demo-resume.txt",
    resumeText: resumeHeader(
      "ARJUN SHAH",
      "Product designer | Figma, design systems and UX research",
      "B.Des Communication Design, NID Ahmedabad (2023). Focus on interaction design and visual systems.",
      "Product Design Intern, Kite Labs (Jan-Sep 2023).\n- Rebuilt the onboarding flow end to end: 11 Prototyping screens in Figma, shipped in two releases.\n- Extended the design system from 14 to 63 components and wrote the usage rules that other teams followed.\n- Ran UX Research: 5 moderated usability sessions per iteration, affinity-mapped the notes, and turned findings into ranked fixes.\n- Applied accessibility basics to every UI Design deliverable (contrast, focus order, 44px targets) and closed all audit findings before release.\n- Worked directly with two engineers on UI Design hand-off; zero rework tickets in the final month.",
    ),
    joinedDaysAgo: 20,
    note: "Strong design profile. Verification was flagged and routed to a human reviewer.",
  },
  // --- E. strong HR profile -------------------------------------------------
  {
    key: "kavya_menon",
    name: "Kavya Menon",
    email: "kavya.menon@demo.local",
    headline: "HR & Recruitment associate | hiring, interviewing and HR operations",
    skills: ["Communication", "Recruitment", "Interviewing", "MS Office", "HR Fundamentals", "Candidate Sourcing", "Onboarding"],
    education: "BBA Human Resource Management, Coimbatore (2023)",
    experience: "Talent Acquisition Associate, Meridian Staffing (14 months) — 90+ hires, 4 business units.",
    resumeFile: "kavya-menon-demo-resume.txt",
    resumeText: resumeHeader(
      "KAVYA MENON",
      "HR & Recruitment associate | hiring, interviewing and HR operations",
      "BBA Human Resource Management, Coimbatore (2023). Core: HR Fundamentals, organisational behaviour, labour law basics.",
      "Talent Acquisition Associate, Meridian Staffing (Jun 2022 - Aug 2023).\n- Ran full-cycle Recruitment for 4 business units: 90+ hires at a 22-day average time-to-hire.\n- Screened 300+ applicants and ran 140+ first-round structured Interviewing calls.\n- Wrote candidate Communication that lifted offer-acceptance from 68% to 84% by replacing jargon with plain answers about the role.\n- Rebuilt the HR Fundamentals onboarding pack: 32 documents, checklist automation, zero missed items in two quarters.\n- Kept headcount, attrition and pipeline reports in MS Office for a 260-person client portfolio.",
    ),
    joinedDaysAgo: 22,
    note: "Strongest HR profile in the demo pool.",
  },
  // --- F. weak match, incomplete profile ------------------------------------
  {
    key: "ishaan_verma",
    name: "Ishaan Verma",
    email: "ishaan.verma@demo.local",
    // No headline, only two skills, no resume — the intentionally incomplete
    // profile that keeps Profile Ready and several achievements locked.
    headline: "",
    skills: ["Communication", "MS Office"],
    education: "B.Com, University of Pune (2024)",
    experience: "No formal work experience recorded yet.",
    resumeFile: null,
    resumeText: null,
    joinedDaysAgo: 9,
    note: "New to the platform. Profile and resume still outstanding.",
  },
  // --- G. unverified, design-adjacent ---------------------------------------
  {
    key: "diya_kulkarni",
    name: "Diya Kulkarni",
    email: "diya.kulkarni@demo.local",
    headline: "UI designer | Figma, prototyping and front-end markup",
    skills: ["Figma", "UI Design", "Prototyping", "UX Research", "HTML", "CSS"],
    education: "BFA Applied Arts, Symbiosis Institute (2024)",
    experience: "Freelance UI designer (10 months) — 6 client projects, two long-running.",
    resumeFile: "diya-kulkarni-demo-resume.txt",
    resumeText: resumeHeader(
      "DIYA KULKARNI",
      "UI designer | Figma, prototyping and front-end markup",
      "BFA Applied Arts, Symbiosis Institute (2024). Practical UI Design coursework; short UX Research methods course.",
      "Freelance UI Designer (Mar 2023 - Dec 2023).\n- Delivered 6 client projects, each shipped as a Figma file with full Prototyping.\n- Built a 22-screen marketing site in Figma and translated two sections to hand-written HTML and CSS with a developer.\n- Ran 3 short UX Research sessions per project and iterated the flows on the findings.\n- Maintained a personal component library in Figma; documented naming and usage rules.",
    ),
    joinedDaysAgo: 15,
    note: "Design-adjacent profile that also applies outside design. No verification on file.",
  },
  // --- H. verified, strong marketing ----------------------------------------
  {
    key: "aditya_joshi",
    name: "Aditya Joshi",
    email: "aditya.joshi@demo.local",
    headline: "Marketing associate | digital campaigns, content and analytics",
    skills: ["Digital Marketing", "Content Writing", "Communication", "Social Media", "Analytics", "SEO", "Google Ads"],
    education: "BBA Marketing, Symbiosis Institute (2023)",
    experience: "Digital Marketing Associate, Brightline Media (11 months) — two product lines, 40+ campaigns.",
    resumeFile: "aditya-joshi-demo-resume.txt",
    resumeText: resumeHeader(
      "ADITYA JOSHI",
      "Marketing associate | digital campaigns, content and analytics",
      "BBA Marketing, Symbiosis Institute (2023). Minor in Communication.",
      "Digital Marketing Associate, Brightline Media (Feb 2023 - Jan 2024).\n- Owned always-on Digital Marketing for two product lines across Google Ads and Meta; managed a monthly budget equivalent of 4 lakh rupees.\n- Wrote 180+ pieces of Content Writing; the long-form template lifted organic traffic 64% over two quarters.\n- Ran the Social Media calendar for three channels, 5 posts a week, with zero guideline breaches in the final quarter.\n- Built the weekly Analytics report: spend, CAC and pipeline-sourced leads, each with a written recommended action.\n- Added on-page SEO to 40+ landing pages, lifting keyword coverage from 22% to 71%.",
    ),
    joinedDaysAgo: 17,
    note: "Strong marketing profile with verified identity.",
  },
  // --- I. verified, cross-functional marketing/HR ---------------------------
  {
    key: "nisha_patel",
    name: "Nisha Patel",
    email: "nisha.patel@demo.local",
    headline: "Marketing and communications associate | content, social and analytics",
    skills: ["Digital Marketing", "Content Writing", "Communication", "Social Media", "Analytics", "Recruitment"],
    education: "B.A. English Literature, Gujarat University (2023)",
    experience: "Communications Associate, Trellis Learning (9 months) — candidate marketing and internal comms.",
    resumeFile: "nisha-patel-demo-resume.txt",
    resumeText: resumeHeader(
      "NISHA PATEL",
      "Marketing and communications associate | content, social and analytics",
      "B.A. English Literature, Gujarat University (2023). Strong writing background; completed a Digital Marketing certificate.",
      "Communications Associate, Trellis Learning (Apr 2023 - Dec 2023).\n- Wrote all candidate-facing Content Writing for two hiring campaigns, including the offer email sequence.\n- Ran the Social Media calendar for the careers brand, 4 posts a week across two channels.\n- Set up the Analytics dashboard the marketing and Recruitment leads now use weekly.\n- Ran a short internal survey (n=88) and turned the results into a written Communication brief for leadership.",
    ),
    joinedDaysAgo: 19,
    note: "Applies broadly, which is why she appears on all five demo roles.",
  },
  // --- J. moderate, no headline, verified-flagged ----------------------------
  {
    key: "rahul_iyer",
    name: "Rahul Iyer",
    email: "rahul.iyer@demo.local",
    // No headline: the profile reads 2/3 complete, so Profile Ready stays
    // locked even though the resume is on file and the candidate is active.
    headline: "",
    skills: ["Python", "SQL", "Excel", "Figma", "UI Design"],
    education: "B.Tech Information Technology, Anna University (2024)",
    experience: "Two short project internships — one analytics, one front-end.",
    resumeFile: "rahul-iyer-demo-resume.txt",
    resumeText: resumeHeader(
      "RAHUL IYER",
      "",
      "B.Tech Information Technology, Anna University (2024). Final-year project on reporting dashboards.",
      "Project internships.\n- Three-month analytics project: built a Python and SQL pipeline for a college attendance dataset and presented the results to the department.\n- Two-month front-end project: designed and Prototyped a campus notice board in Figma and built the static pages in HTML and CSS.\nFinal-year project: a reporting dashboard in Python with an Excel export.",
    ),
    joinedDaysAgo: 12,
    note: "Cross-domain profile. Verification flagged and queued for human review.",
  },
];

// ------------------------------------------------------------- applications

export type DemoApplicationSpec = {
  candidateKey: string;
  jobKey: string;
  /** Days before "today" that the application was submitted. */
  appliedDaysAgo: number;
  note: string;
};

/**
 * 32 applications over 5 roles. Deliberately NOT an all-against-all matrix —
 * a real pipeline has uneven coverage, and the sparse rows are what make the
 * recruiter's "awaiting screening" and "not shortlisted" views meaningful.
 *
 * Application status is NOT set here. It is derived from the real ranking the
 * seed produces, so the status can never contradict the score shown beside it.
 */
export const DEMO_APPLICATIONS: DemoApplicationSpec[] = [
  // 7 applicants — the busiest role.
  { candidateKey: "ananya_rao", jobKey: "junior_data_analyst", appliedDaysAgo: 19, note: "Available immediately." },
  { candidateKey: "rohan_kapoor", jobKey: "junior_data_analyst", appliedDaysAgo: 16, note: "Fresher, available from next month." },
  { candidateKey: "meera_nair", jobKey: "junior_data_analyst", appliedDaysAgo: 15, note: "Research background, keen to move into analytics." },
  { candidateKey: "aditya_joshi", jobKey: "junior_data_analyst", appliedDaysAgo: 13, note: "Analytics reporting experience in marketing." },
  { candidateKey: "rahul_iyer", jobKey: "junior_data_analyst", appliedDaysAgo: 12, note: "Final-year student, part-time only." },
  { candidateKey: "nisha_patel", jobKey: "junior_data_analyst", appliedDaysAgo: 11, note: "Analytics dashboard work, moving from comms." },
  { candidateKey: "ishaan_verma", jobKey: "junior_data_analyst", appliedDaysAgo: 5, note: "Entry-level applicant." },

  // 6 applicants.
  { candidateKey: "meera_nair", jobKey: "psychology_research_intern", appliedDaysAgo: 17, note: "Dissertation on shift work and sleep." },
  { candidateKey: "ananya_rao", jobKey: "psychology_research_intern", appliedDaysAgo: 14, note: "Statistics-heavy final year." },
  { candidateKey: "kavya_menon", jobKey: "psychology_research_intern", appliedDaysAgo: 12, note: "Employee survey work in a previous role." },
  { candidateKey: "rahul_iyer", jobKey: "psychology_research_intern", appliedDaysAgo: 8, note: "Interested in behavioural research." },
  { candidateKey: "nisha_patel", jobKey: "psychology_research_intern", appliedDaysAgo: 6, note: "Ran an internal survey of 88 people." },
  { candidateKey: "ishaan_verma", jobKey: "psychology_research_intern", appliedDaysAgo: 4, note: "Exploring a first career in research." },

  // 7 applicants.
  { candidateKey: "arjun_shah", jobKey: "uiux_design_intern", appliedDaysAgo: 13, note: "Portfolio available on request." },
  { candidateKey: "diya_kulkarni", jobKey: "uiux_design_intern", appliedDaysAgo: 12, note: "Freelance, 6 shipped projects." },
  { candidateKey: "rahul_iyer", jobKey: "uiux_design_intern", appliedDaysAgo: 10, note: "Front-end project work." },
  { candidateKey: "meera_nair", jobKey: "uiux_design_intern", appliedDaysAgo: 9, note: "Ran 3 usability sessions this year." },
  { candidateKey: "nisha_patel", jobKey: "uiux_design_intern", appliedDaysAgo: 7, note: "Comfortable with research tooling." },
  { candidateKey: "aditya_joshi", jobKey: "uiux_design_intern", appliedDaysAgo: 6, note: "Landing pages and creative testing." },
  { candidateKey: "ishaan_verma", jobKey: "uiux_design_intern", appliedDaysAgo: 3, note: "Entry-level applicant." },

  // 5 applicants.
  { candidateKey: "kavya_menon", jobKey: "hr_recruitment_intern", appliedDaysAgo: 9, note: "14 months in full-cycle recruitment." },
  { candidateKey: "rohan_kapoor", jobKey: "hr_recruitment_intern", appliedDaysAgo: 8, note: "Strong communication, wants an HR track." },
  { candidateKey: "nisha_patel", jobKey: "hr_recruitment_intern", appliedDaysAgo: 7, note: "Ran candidate communications for two campaigns." },
  { candidateKey: "diya_kulkarni", jobKey: "hr_recruitment_intern", appliedDaysAgo: 6, note: "Looking to move out of freelance." },
  { candidateKey: "meera_nair", jobKey: "hr_recruitment_intern", appliedDaysAgo: 5, note: "Participant recruitment experience." },

  // 7 applicants — the newest role, so the highest share of unreviewed rows.
  { candidateKey: "aditya_joshi", jobKey: "marketing_associate", appliedDaysAgo: 6, note: "Two product lines, 40+ campaigns." },
  { candidateKey: "nisha_patel", jobKey: "marketing_associate", appliedDaysAgo: 6, note: "Careers brand and internal comms." },
  { candidateKey: "kavya_menon", jobKey: "marketing_associate", appliedDaysAgo: 5, note: "Wrote the offer email sequence." },
  { candidateKey: "meera_nair", jobKey: "marketing_associate", appliedDaysAgo: 5, note: "Participant survey work; comfortable with survey tooling." },
  { candidateKey: "rohan_kapoor", jobKey: "marketing_associate", appliedDaysAgo: 4, note: "Content and social media interest." },
  { candidateKey: "diya_kulkarni", jobKey: "marketing_associate", appliedDaysAgo: 3, note: "Freelance client work." },
  { candidateKey: "ishaan_verma", jobKey: "marketing_associate", appliedDaysAgo: 2, note: "Entry-level applicant." },
  { candidateKey: "rahul_iyer", jobKey: "marketing_associate", appliedDaysAgo: 1, note: "Most recent application in the demo pool." },
];

// -------------------------------------------------------------- verification

export type DemoVerificationSpec = {
  candidateKey: string;
  jobKey: string;
  /** pass | flagged. "Pending" is represented by the absence of a session. */
  result: "pass" | "flagged";
  reviewedByHR: boolean;
  /**
   * SYNTHETIC constants chosen to drive the demo UI. These are NOT biometric
   * measurements and were not produced by the verification ML service.
   */
  gazeScore: number;
  lipSyncScore: number;
  audioScore: number;
  /** No liveness column exists; carried in rawSignals instead. */
  livenessScore: number;
  reasons: string[];
  daysAgo: number;
};

const SYNTHETIC = "SYNTHETIC DEMO";

export const DEMO_VERIFICATIONS: DemoVerificationSpec[] = [
  {
    candidateKey: "ananya_rao",
    jobKey: "junior_data_analyst",
    result: "pass",
    reviewedByHR: false,
    gazeScore: 0.94,
    lipSyncScore: 0.91,
    audioScore: 0.96,
    livenessScore: 0.97,
    reasons: [`${SYNTHETIC} — synthetic clip: all three signals inside tolerance.`],
    daysAgo: 17,
  },
  {
    candidateKey: "meera_nair",
    jobKey: "psychology_research_intern",
    result: "pass",
    reviewedByHR: false,
    gazeScore: 0.96,
    lipSyncScore: 0.89,
    audioScore: 0.93,
    livenessScore: 0.98,
    reasons: [`${SYNTHETIC} — synthetic clip: all three signals inside tolerance.`],
    daysAgo: 15,
  },
  {
    candidateKey: "kavya_menon",
    jobKey: "hr_recruitment_intern",
    result: "pass",
    reviewedByHR: false,
    gazeScore: 0.92,
    lipSyncScore: 0.93,
    audioScore: 0.9,
    livenessScore: 0.95,
    reasons: [`${SYNTHETIC} — synthetic clip: all three signals inside tolerance.`],
    daysAgo: 8,
  },
  {
    candidateKey: "aditya_joshi",
    jobKey: "marketing_associate",
    result: "pass",
    reviewedByHR: false,
    gazeScore: 0.9,
    lipSyncScore: 0.88,
    audioScore: 0.92,
    livenessScore: 0.93,
    reasons: [`${SYNTHETIC} — synthetic clip: all three signals inside tolerance.`],
    daysAgo: 5,
  },
  {
    candidateKey: "nisha_patel",
    jobKey: "marketing_associate",
    result: "pass",
    reviewedByHR: false,
    gazeScore: 0.93,
    lipSyncScore: 0.9,
    audioScore: 0.95,
    livenessScore: 0.96,
    reasons: [`${SYNTHETIC} — synthetic clip: all three signals inside tolerance.`],
    daysAgo: 5,
  },
  {
    candidateKey: "arjun_shah",
    jobKey: "uiux_design_intern",
    result: "flagged",
    reviewedByHR: true,
    gazeScore: 0.71,
    lipSyncScore: 0.83,
    audioScore: 0.77,
    livenessScore: 0.9,
    reasons: [
      `${SYNTHETIC} — synthetic flag: on-screen gaze ratio 0.710 is below the 0.800 review threshold.`,
      `${SYNTHETIC} — routed to a human reviewer. This is not a rejection.`,
    ],
    daysAgo: 11,
  },
  {
    candidateKey: "rahul_iyer",
    jobKey: "junior_data_analyst",
    result: "flagged",
    reviewedByHR: true,
    gazeScore: 0.68,
    lipSyncScore: 0.86,
    audioScore: 0.81,
    livenessScore: 0.94,
    reasons: [
      `${SYNTHETIC} — synthetic flag: on-screen gaze ratio 0.680 is below the 0.800 review threshold.`,
      `${SYNTHETIC} — routed to a human reviewer. This is not a rejection.`,
    ],
    daysAgo: 10,
  },
];

// ------------------------------------------------------------------ token plan

/**
 * Ledger events, in the order the seed replays them.
 *
 * The AMOUNT IS NOT HERE ON PURPOSE. `earn()` and `earnWithAmount()` own the
 * amounts: `REWARD_RULES` in lib/tokens.ts for the fixed event types, and the
 * assessment / achievement row's own `tokenReward` column for the other two.
 * The seed only ever states *which event happened* — the same thing a browser
 * is allowed to say — and the wallet balance is whatever the ledger sums to.
 * That is what keeps `balance === sum(transactions)` true by construction
 * rather than by hand.
 *
 * Dates are the one thing these rows do NOT get. `record()` stamps
 * `nowIso()`, and back-dating would mean writing to the ledger behind the
 * reward API's back. So every demo ledger entry is stamped at seed time,
 * which is also why the "5 different days" achievement stays locked for the
 * demo candidates instead of being faked.
 */
export type DemoTokenEvent = {
  candidateKey: string;
  type:
    | "DAILY_LOGIN"
    | "RESUME_UPLOAD"
    | "PROFILE_COMPLETION"
    | "JOB_APPLICATION"
    | "VERIFICATION_COMPLETION";
  /** Which application this refers to, when the type needs one. */
  jobKey?: string;
};

// -------------------------------------------------------------- achievements

/**
 * Assessment outcomes. `correct` is fed to the real grader through
 * `submitAttempt()`, so the stored score is whatever the real scoring
 * function computes from that many right answers — it is never written
 * directly. Each assessment has 10 questions, so a score is always a multiple
 * of ten; `correct` picks the nearest achievable value.
 */
export type DemoAssessmentSpec = {
  candidateKey: string;
  /** Assessment id from SEED_ASSESSMENTS. */
  assessmentId: "asm_psychology_fundamentals" | "asm_workplace_skills" | "asm_problem_solving";
  correct: number;
  /** `false` leaves the attempt open, which shows the in-progress state. */
  complete: boolean;
  startedDaysAgo: number;
};

export const DEMO_ASSESSMENTS: DemoAssessmentSpec[] = [
  { candidateKey: "ananya_rao", assessmentId: "asm_psychology_fundamentals", correct: 9, complete: true, startedDaysAgo: 22 },
  { candidateKey: "rohan_kapoor", assessmentId: "asm_workplace_skills", correct: 8, complete: true, startedDaysAgo: 15 },
  { candidateKey: "meera_nair", assessmentId: "asm_psychology_fundamentals", correct: 9, complete: true, startedDaysAgo: 21 },
  { candidateKey: "arjun_shah", assessmentId: "asm_workplace_skills", correct: 7, complete: true, startedDaysAgo: 18 },
  { candidateKey: "kavya_menon", assessmentId: "asm_psychology_fundamentals", correct: 8, complete: true, startedDaysAgo: 16 },
  { candidateKey: "diya_kulkarni", assessmentId: "asm_problem_solving", correct: 8, complete: true, startedDaysAgo: 13 },
  { candidateKey: "aditya_joshi", assessmentId: "asm_problem_solving", correct: 7, complete: true, startedDaysAgo: 14 },
  { candidateKey: "nisha_patel", assessmentId: "asm_workplace_skills", correct: 9, complete: true, startedDaysAgo: 12 },
  { candidateKey: "rahul_iyer", assessmentId: "asm_problem_solving", correct: 6, complete: true, startedDaysAgo: 9 },
  // Started but never submitted: the demo's "assessment in progress" state.
  { candidateKey: "ishaan_verma", assessmentId: "asm_workplace_skills", correct: 0, complete: false, startedDaysAgo: 2 },
];

/**
 * Achievements are NOT listed here.
 *
 * The seed calls the real `evaluateAchievements()` once the applications,
 * verifications and attempts are in place, and whatever the existing progress
 * rules unlock is what the candidate ends up holding. Hand-picking unlocks
 * would be the fastest way to ship an impossible state (a "Verified" badge on
 * a candidate with no passing session), so there is no way to do it by
 * accident from this file.
 */
export const DEMO_ACHIEVEMENT_POLICY =
  "Unlocked by lib/achievements.ts evaluateAchievements() against real progress rules. Never written by the seed.";
