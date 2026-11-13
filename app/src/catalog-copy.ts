// Names and the short line shown on hover for the built-in agents, skills and activities.
// The id stays the file name. A person's own item keeps the name and description they wrote.
// The English text is the source; pt-BR and es translate it.

import { t } from './i18n';

interface Copy { label: string; hint: string }

const AGENTS: Record<string, Copy> = {
  'qa-lead': { label: 'QA Lead', hint: 'Leads a quality request. Picks the skill or the workflow and stops at every approval.' },
  'requirements-analyst': { label: 'Story reviewer', hint: 'Reviews the story with the person writing or checking it, in product or in QA, until the reading is the same.' },
  'round-reviewer': { label: 'Round reviewer', hint: 'Takes the review one round further and prepares what the team needs to see. Does not publish.' },
  'test-designer': { label: 'Test designer', hint: 'Maps the scenarios and, after your OK, writes the test cases.' },
  'failure-analyst': { label: 'Failure analyst', hint: 'Points to the likely cause of an error from the report and the log.' },
  'evidence-builder': { label: 'Evidence builder', hint: 'Builds the evidence of an executed test, from the spreadsheet to the document.' },
  'api-tester': { label: 'API tester', hint: 'Runs the API tests in the approved environment and checks the result.' },
  sentinela: { label: 'Sentinela', hint: 'Assesses the API contract and coverage and runs the tests when you ask.' },
  lestrade: { label: 'Lestrade', hint: 'Registers the item in Azure DevOps or Jira, in the type the project uses.' },
  wiggins: { label: 'Wiggins', hint: 'Publishes the prepared comment or file on the item, without changing the text.' },
  'routine-analyst': { label: 'Routine analyst', hint: 'Prepares the approval of a change a routine already detected. Does not apply the change.' },
  'automation-engineer': { label: 'Automation engineer', hint: 'Looks after the test automation project. Not available yet.' },
  inventor: { label: 'Inventor', hint: 'Designs the solution, with requirements, alternatives, decisions and what can be verified.' },
  cartografo: { label: 'Cartógrafo', hint: 'Models the data and the database, from the rules to the dictionary and the SQL.' },
  artesao: { label: 'Artesão', hint: 'Designs and builds the interface, with interaction, responsive layout and a browser check.' },
  sherlock: { label: 'Sherlock', hint: 'Investigates a topic in depth and returns a dossier with the sources he opened.' },
  moriarty: { label: 'Moriarty', hint: 'Attacks a finished piece and says what holds and what does not.' },
  watson: { label: 'Watson', hint: 'Organizes and formats the document for the person who will read it.' },
  hudson: { label: 'Hudson', hint: 'Looks at the files the runs left and proposes what to keep, rename or remove.' },
  configurador: { label: 'Configurador', hint: 'Sets Moki up from what the person describes and applies only what they approve.' },
  'moki-consultant': { label: 'Moki consultant', hint: 'Explains Moki and proposes the change. Does not edit files.' },
  'moki-executor': { label: 'Moki executor', hint: 'Implements in Moki a change that was already approved.' },
  'moki-orquestrador': { label: 'Moki orchestrator', hint: 'Splits a large Moki change, has it implemented and checks the result.' },
  'quality-agents-expert': { label: 'Moki specialist', hint: 'Explains how Moki fits together and changes the framework itself.' },
  'artcraft-router': { label: 'ArtCraft router', hint: 'Decides which ArtCraft suite tool answers the request.' },
  'craft-launcher-specialist': { label: 'Launcher specialist', hint: 'Explains ArtCraft Launcher: catalog, install, update and opening apps.' },
  'office-apps-specialist': { label: 'Office specialist', hint: 'Sends documents, spreadsheets and presentations to WordCraft, GridCraft and DeckCraft.' },
  'adobe-apps-specialist': { label: 'Adobe specialist', hint: 'Sends photos, video, layout and PDF to the matching ArtCraft tool.' },
};

const SKILLS: Record<string, Copy> = {
  'requirements-review': { label: 'Story review', hint: 'The review procedure: reading, one question at a time, the matrix and the final report.' },
  'test-design': { label: 'Test design', hint: 'Maps the scenarios and, after your OK, writes the test cases.' },
  'failure-analysis': { label: 'Failure pre-analysis', hint: 'Reads the report and the log and points to where the failure likely is.' },
  'evidence-collection': { label: 'Evidence collection', hint: 'Gathers what was executed in the test until the evidence is approved.' },
  'evidence-sheet': { label: 'Evidence spreadsheet', hint: 'Builds the evidence spreadsheet, one row per test case.' },
  'evidence-document': { label: 'Evidence document', hint: 'Builds the evidence document, with the images on each step.' },
  'api-assessment': { label: 'API assessment', hint: 'Assesses the contract, permissions and coverage without calling the API.' },
  'api-testing': { label: 'API testing', hint: 'Runs the requests in the approved environment and checks status, shape and body.' },
  'item-report': { label: 'Item registration', hint: 'Prepares the item and creates or comments only after approval.' },
  automation: { label: 'Automation', hint: 'Builds and evolves the automation project. Not available yet.' },
  documentation: { label: 'Scenario base', hint: 'Proposes updates to the official scenario base. Not available yet.' },
  'smoke-test': { label: 'Smoke', hint: 'Runs the short pre-check of an improvement. Not available yet.' },
  'solution-design': { label: 'Solution design', hint: 'Goes from the problem to a solution with alternatives, decisions and verification.' },
  'data-modeling': { label: 'Data modeling', hint: 'Draws the model, the diagram and the dictionary from the confirmed rules.' },
  'database-engineering': { label: 'Database engineering', hint: 'Writes and reviews the database SQL, and runs only an approved plan.' },
  'interface-prototyping': { label: 'Interface prototype', hint: 'Builds a working, responsive and accessible interface and checks it in the browser.' },
  deduction: { label: 'Investigation', hint: 'Researches the topic in depth and delivers a dossier with a source opened for each claim.' },
  'cross-examination': { label: 'Critique', hint: 'Attacks a finished piece, checks the sources and returns a verdict. Does not rewrite it.' },
  chronicle: { label: 'Text organization', hint: 'Organizes the content for the reader, without adding a fact.' },
  'document-design': { label: 'Formatting', hint: 'Formats the document in the format that was asked for.' },
  'document-quality': { label: 'Final check', hint: 'Checks that the document matches its source and that it opens.' },
  blueprint: { label: 'Diagrams', hint: 'Draws the diagram inside the document.' },
  'qa-orchestrator': { label: 'Orchestration', hint: 'Understands the request, picks the skill or the workflow and stops at the approvals.' },
  'project-context': { label: 'Project context', hint: 'Reads and updates what the project has already confirmed.' },
  dispatch: { label: 'MCP integration', hint: 'Reads and publishes items through the MCP integration. Without it, asks for the documentation.' },
  'routine-analysis': { label: 'Routine analysis', hint: 'Reads the detected change and leaves the package ready for approval.' },
  'moki-architecture': { label: 'Moki architecture', hint: 'Explains how Moki works, from the code.' },
  'moki-change': { label: 'Moki change', hint: 'Traces the impact, proposes the change and, once approved, implements it and checks.' },
  'craft-launcher': { label: 'ArtCraft Launcher', hint: 'Reference for the launcher: catalog, install, update and opening apps.' },
  wordcraft: { label: 'WordCraft', hint: 'Reference for WordCraft, for writing and formatting a document.' },
  gridcraft: { label: 'GridCraft', hint: 'Reference for GridCraft, for spreadsheets and data.' },
  deckcraft: { label: 'DeckCraft', hint: 'Reference for DeckCraft, for presentations.' },
  photocraft: { label: 'PhotoCraft', hint: 'Reference for PhotoCraft, for image editing.' },
  lightcraft: { label: 'LightCraft', hint: 'Reference for LightCraft, for the photo library and raw files.' },
  vectorcraft: { label: 'VectorCraft', hint: 'Reference for VectorCraft, for vector illustration.' },
  filmcraft: { label: 'FilmCraft', hint: 'Reference for FilmCraft, for video, color and sound.' },
  effectcraft: { label: 'EffectCraft', hint: 'Reference for EffectCraft, for motion and effects.' },
  designcraft: { label: 'DesignCraft', hint: 'Reference for DesignCraft, for page layout.' },
  pdfcraft: { label: 'PdfCraft', hint: 'Reference for PdfCraft, for reading, organizing and protecting PDFs.' },
  figcraft: { label: 'FigCraft', hint: 'Reference for FigCraft, for interface design.' },
  cadcraft: { label: 'CADCraft', hint: 'Reference for CADCraft, for technical drawing.' },
  soundcraft: { label: 'SoundCraft', hint: 'Reference for SoundCraft, for recording, editing and mixing audio.' },
};

const ACTIVITIES: Record<string, Copy> = {
  review: { label: 'Review stories', hint: 'For the person writing or checking the story, in product or in QA. Asks whether to start from the MCP integration or from the documents, and runs the review through to the report.' },
  'review-tracker': { label: 'Review through the integration', hint: 'Reads the story through the MCP integration and runs the same review.' },
  'review-then-tests': { label: 'Review, then design tests', hint: 'Reviews the story and, after approval, designs the tests.' },
  tests: { label: 'Design tests', hint: 'Maps the scenarios and then writes the test cases.' },
  failure: { label: 'Pre-analyze a failure', hint: 'Reads the report and the log and points to the likely cause.' },
  evidence: { label: 'Build the evidence', hint: 'Gathers what was executed and produces the spreadsheet and the document.' },
  'register-item': { label: 'Register items with Lestrade', hint: 'Registers a bug, impediment, task or improvement from the material you send.' },
  'validate-api': { label: 'Validate an API with Sentinela', hint: 'Assesses the contract and coverage and runs the tests when you ask.' },
  automation: { label: 'Automate tests', hint: 'Starts test automation. Not available yet.' },
  investigate: { label: 'Investigate with Sherlock', hint: 'Researches a topic in depth and delivers a dossier with the sources.' },
  'cross-examine': { label: 'Critique with Moriarty', hint: 'Attacks a finished piece and returns a verdict, without rewriting it.' },
  document: { label: 'Write a document with Watson', hint: 'Organizes, formats and checks any document.' },
  'design-solution': { label: 'Design the solution with Inventor', hint: 'Goes from the problem to a solution with alternatives and decisions.' },
  'model-data': { label: 'Model data with Cartógrafo', hint: 'Draws entities, relationships and the dictionary so they stay consistent.' },
  'prototype-interface': { label: 'Prototype an interface with Artesão', hint: 'Builds a working interface and checks it in the browser.' },
  open: { label: 'Just open the project', hint: 'Opens the project, loads the context and asks what you need.' },
  context: { label: 'Project context', hint: 'Asks the onboarding questions and updates what the project has confirmed.' },
  setup: { label: 'Prepare the project', hint: 'Adapts the context to the project description.' },
  plan: { label: 'Plan the project', hint: 'Interviews you and leaves a plan for you to review.' },
  resume: { label: 'Resume a run', hint: 'Continues a review or a piece of work that stopped.' },
};

function face(table: Record<string, Copy>, id: string, fallbackLabel: string, fallbackHint: string): Copy {
  const copy = table[id];
  return { label: t(copy?.label ?? fallbackLabel), hint: t(copy?.hint ?? fallbackHint) };
}

export const agentFace = (name: string, description = ''): Copy => face(AGENTS, name, name, description);
export const skillFace = (name: string, description = ''): Copy => face(SKILLS, name, name, description);
export const activityFace = (id: string, label: string, hint: string): Copy => face(ACTIVITIES, id, label, hint);
