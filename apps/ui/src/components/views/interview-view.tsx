// @ts-nocheck
import { useState, useCallback, useRef, useEffect } from 'react';
import { createLogger } from '@automaker/utils/logger';
import { useAppStore, Feature } from '@/store/app-store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Bot, Send, User, Loader2, Sparkles, FileText, ArrowLeft, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getElectronAPI } from '@/lib/electron';
import { Markdown } from '@/components/ui/markdown';
import { useFileBrowser } from '@/contexts/file-browser-context';
import { toast } from 'sonner';
import { useNavigate } from '@tanstack/react-router';
import { getDefaultWorkspaceDirectory, saveLastProjectDirectory } from '@/lib/workspace-config';

const logger = createLogger('InterviewView');

interface InterviewMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface InterviewState {
  projectName: string;
  projectDescription: string;
  techStack: string[];
  features: string[];
  additionalNotes: string;
}

// Interview questions flow - German
const INTERVIEW_QUESTIONS = [
  {
    id: 'project-description',
    question: 'Was möchtest du entwickeln?',
    hint: 'Beschreibe deine Projektidee in wenigen Sätzen',
    field: 'projectDescription' as const,
  },
  {
    id: 'tech-stack',
    question: 'Welchen Tech-Stack möchtest du verwenden?',
    hint: 'z.B. React, Next.js, Node.js, Python, etc.',
    field: 'techStack' as const,
  },
  {
    id: 'core-features',
    question: 'Welche Kernfunktionen soll dein Projekt haben?',
    hint: 'Liste die wichtigsten Funktionalitäten auf',
    field: 'features' as const,
  },
  {
    id: 'additional',
    question: 'Gibt es weitere Anforderungen oder Präferenzen?',
    hint: 'Design-Vorlieben, Integrationen, Deployment-Anforderungen, etc.',
    field: 'additionalNotes' as const,
  },
];

export function InterviewView() {
  const { addProject, setCurrentProject, setAppSpec } = useAppStore();
  const { openFileBrowser } = useFileBrowser();
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<InterviewMessage[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [interviewData, setInterviewData] = useState<InterviewState>({
    projectName: '',
    projectDescription: '',
    techStack: [],
    features: [],
    additionalNotes: '',
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [generatedSpec, setGeneratedSpec] = useState<string | null>(null);
  const [projectPath, setProjectPath] = useState('');
  const [projectName, setProjectName] = useState('');
  const [showProjectSetup, setShowProjectSetup] = useState(false);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Default parent directory using workspace config utility
  useEffect(() => {
    if (projectPath) return;

    let isMounted = true;

    const loadWorkspaceDir = async () => {
      try {
        const defaultDir = await getDefaultWorkspaceDirectory();

        if (!isMounted || projectPath) {
          return;
        }

        if (defaultDir) {
          setProjectPath(defaultDir);
        }
      } catch (error) {
        logger.error('Failed to load default workspace directory:', error);
      }
    };

    loadWorkspaceDir();

    return () => {
      isMounted = false;
    };
  }, [projectPath]);

  // Initialize with first question
  useEffect(() => {
    if (messages.length === 0) {
      const welcomeMessage: InterviewMessage = {
        id: 'welcome',
        role: 'assistant',
        content: `Hallo! Ich bin hier, um dir bei der Planung deines neuen Projekts zu helfen. Lass uns ein paar Fragen durchgehen, um zu verstehen, was du entwickeln möchtest.\n\n**${INTERVIEW_QUESTIONS[0].question}**\n\n_${INTERVIEW_QUESTIONS[0].hint}_`,
        timestamp: new Date(),
      };
      setMessages([welcomeMessage]);
    }
  }, [messages.length]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | undefined;
    if (messagesContainerRef.current) {
      // Use a small delay to ensure DOM is updated
      timeoutId = setTimeout(() => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTo({
            top: messagesContainerRef.current.scrollHeight,
            behavior: 'smooth',
          });
        }
      }, 100);
    }
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [messages]);

  // Auto-focus input
  useEffect(() => {
    if (inputRef.current && !isComplete) {
      inputRef.current.focus();
    }
  }, [currentQuestionIndex, isComplete]);

  const handleSend = useCallback(() => {
    if (!input.trim() || isGenerating || isComplete) return;

    const userMessage: InterviewMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);

    // Update interview data based on current question
    const currentQuestion = INTERVIEW_QUESTIONS[currentQuestionIndex];
    if (currentQuestion) {
      setInterviewData((prev) => {
        const newData = { ...prev };
        if (currentQuestion.field === 'techStack' || currentQuestion.field === 'features') {
          // Parse comma-separated values into array
          newData[currentQuestion.field] = input
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        } else {
          (newData as Record<string, string | string[]>)[currentQuestion.field] = input;
        }
        return newData;
      });
    }

    setInput('');

    // Move to next question or complete
    const nextIndex = currentQuestionIndex + 1;

    setTimeout(() => {
      if (nextIndex < INTERVIEW_QUESTIONS.length) {
        const nextQuestion = INTERVIEW_QUESTIONS[nextIndex];
        const assistantMessage: InterviewMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: `Super! **${nextQuestion.question}**\n\n_${nextQuestion.hint}_`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
        setCurrentQuestionIndex(nextIndex);
      } else {
        // All questions answered - generate spec
        const summaryMessage: InterviewMessage = {
          id: `assistant-summary-${Date.now()}`,
          role: 'assistant',
          content:
            'Perfekt! Ich habe alle Informationen, die ich brauche. Jetzt erstelle ich deine Projektspezifikation...',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, summaryMessage]);
        generateSpec({
          ...interviewData,
          projectDescription: currentQuestionIndex === 0 ? input : interviewData.projectDescription,
          techStack:
            currentQuestionIndex === 1
              ? input
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean)
              : interviewData.techStack,
          features:
            currentQuestionIndex === 2
              ? input
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean)
              : interviewData.features,
          additionalNotes: currentQuestionIndex === 3 ? input : interviewData.additionalNotes,
        });
      }
    }, 500);
  }, [input, isGenerating, isComplete, currentQuestionIndex, interviewData]);

  const generateSpec = useCallback(async (data: InterviewState) => {
    setIsGenerating(true);

    // Generate a draft app_spec.txt based on the interview responses
    const spec = generateAppSpec(data);

    // Simulate some processing time for better UX
    await new Promise((resolve) => setTimeout(resolve, 1500));

    setGeneratedSpec(spec);
    setIsGenerating(false);
    setIsComplete(true);
    setShowProjectSetup(true);

    const completionMessage: InterviewMessage = {
      id: `assistant-complete-${Date.now()}`,
      role: 'assistant',
      content: `Ich habe eine Projektspezifikation basierend auf unserem Gespräch erstellt!\n\nBitte gib einen Projektnamen ein und wähle, wo dein Projekt gespeichert werden soll. Dann klicke auf "Projekt erstellen", um loszulegen.`,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, completionMessage]);
  }, []);

  const generateAppSpec = (data: InterviewState): string => {
    const projectName = data.projectDescription
      .split(' ')
      .slice(0, 3)
      .join('-')
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '');

    // Note: Must follow XML format as defined in apps/server/src/lib/app-spec-format.ts
    return `<project_specification>
  <project_name>${projectName || 'my-project'}</project_name>

  <overview>
    ${data.projectDescription}
  </overview>

  <technology_stack>
    ${
      data.techStack.length > 0
        ? data.techStack.map((tech) => `<technology>${tech}</technology>`).join('\n    ')
        : '<!-- Define your tech stack -->'
    }
  </technology_stack>

  <core_capabilities>
    ${
      data.features.length > 0
        ? data.features.map((feature) => `<capability>${feature}</capability>`).join('\n    ')
        : '<!-- List core features -->'
    }
  </core_capabilities>

  <additional_requirements>
    ${data.additionalNotes || 'None specified'}
  </additional_requirements>

  <development_guidelines>
    <guideline>Write clean, production-quality code</guideline>
    <guideline>Include proper error handling</guideline>
    <guideline>Write comprehensive Playwright tests</guideline>
    <guideline>Ensure all tests pass before marking features complete</guideline>
  </development_guidelines>
</project_specification>`;
  };

  const handleSelectDirectory = async () => {
    const selectedPath = await openFileBrowser({
      title: 'Basisverzeichnis auswählen',
      description:
        'Wähle das übergeordnete Verzeichnis, in dem dein neues Projekt erstellt werden soll',
      initialPath: projectPath || undefined,
    });

    if (selectedPath) {
      setProjectPath(selectedPath);
      saveLastProjectDirectory(selectedPath);
    }
  };

  const handleCreateProject = async () => {
    if (!projectName || !projectPath || !generatedSpec) return;

    setIsGenerating(true);

    try {
      saveLastProjectDirectory(projectPath);
      const api = getElectronAPI();
      // Use platform-specific path separator
      const pathSep =
        typeof window !== 'undefined' && (window as Window & { electronAPI?: unknown }).electronAPI
          ? navigator.platform.indexOf('Win') !== -1
            ? '\\'
            : '/'
          : '/';
      const fullProjectPath = `${projectPath}${pathSep}${projectName}`;

      // Create project directory
      const mkdirResult = await api.mkdir(fullProjectPath);
      if (!mkdirResult.success) {
        toast.error('Projektverzeichnis konnte nicht erstellt werden', {
          description: mkdirResult.error || 'Unbekannter Fehler aufgetreten',
        });
        setIsGenerating(false);
        return;
      }

      // Write app_spec.txt with generated content
      await api.writeFile(`${fullProjectPath}/.automaker/app_spec.txt`, generatedSpec);

      // Create initial feature in the features folder
      const initialFeature: Feature = {
        id: crypto.randomUUID(),
        category: 'Core',
        description: 'Initial project setup',
        status: 'backlog' as const,
        skipTests: true,
      };

      if (!api.features) {
        throw new Error('Features API not available');
      }
      await api.features.create(fullProjectPath, initialFeature);

      const project = {
        id: `project-${Date.now()}`,
        name: projectName,
        path: fullProjectPath,
        lastOpened: new Date().toISOString(),
      };

      // Update app spec in store
      setAppSpec(generatedSpec);

      // Add and select the project
      addProject(project);
      setCurrentProject(project);
    } catch (error) {
      logger.error('Failed to create project:', error);
      setIsGenerating(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleGoBack = () => {
    navigate({ to: '/' });
  };

  return (
    <div className="flex-1 flex flex-col content-bg min-h-0" data-testid="interview-view">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-glass backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleGoBack}
            className="h-8 w-8 p-0"
            data-testid="interview-back-button"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Sparkles className="w-5 h-5 text-primary" />
          <div>
            <h1 className="text-xl font-bold">Neues Projekt Interview</h1>
            <p className="text-sm text-muted-foreground">
              {isComplete
                ? 'Spezifikation erstellt!'
                : `Frage ${currentQuestionIndex + 1} von ${INTERVIEW_QUESTIONS.length}`}
            </p>
          </div>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center gap-2">
          {INTERVIEW_QUESTIONS.map((_, index) => (
            <div
              key={index}
              className={cn(
                'w-2 h-2 rounded-full transition-colors',
                index < currentQuestionIndex
                  ? 'bg-green-500'
                  : index === currentQuestionIndex
                    ? 'bg-primary'
                    : 'bg-zinc-700'
              )}
            />
          ))}
          {isComplete && <CheckCircle className="w-4 h-4 text-green-500 ml-2" />}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
        data-testid="interview-messages"
      >
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn('flex gap-3', message.role === 'user' && 'flex-row-reverse')}
          >
            <div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                message.role === 'assistant' ? 'bg-primary/10' : 'bg-muted'
              )}
            >
              {message.role === 'assistant' ? (
                <Bot className="w-4 h-4 text-primary" />
              ) : (
                <User className="w-4 h-4" />
              )}
            </div>
            <Card
              className={cn(
                'max-w-[80%]',
                message.role === 'user'
                  ? 'bg-transparent border border-primary text-foreground'
                  : 'border border-primary/30 bg-card'
              )}
            >
              <CardContent className="px-3 py-2">
                {message.role === 'assistant' ? (
                  <Markdown className="text-sm text-primary prose-headings:text-primary prose-strong:text-primary prose-code:text-primary">
                    {message.content}
                  </Markdown>
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                )}
                <p
                  className={cn(
                    'text-xs mt-1',
                    message.role === 'user' ? 'text-muted-foreground' : 'text-primary/70'
                  )}
                >
                  {message.timestamp.toLocaleTimeString()}
                </p>
              </CardContent>
            </Card>
          </div>
        ))}

        {isGenerating && !showProjectSetup && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <Card className="border border-primary/30 bg-card">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-sm text-primary">Spezifikation wird erstellt...</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Project Setup Form */}
        {showProjectSetup && (
          <div className="mt-6">
            <Card className="bg-zinc-900/50 border-white/10" data-testid="project-setup-form">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-semibold">Dein Projekt erstellen</h3>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="project-name" className="text-sm font-medium text-zinc-300">
                      Projektname
                    </label>
                    <Input
                      id="project-name"
                      placeholder="mein-tolles-projekt"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      className="bg-zinc-950/50 border-white/10 text-white placeholder:text-zinc-500"
                      data-testid="interview-project-name-input"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="project-path" className="text-sm font-medium text-zinc-300">
                      Übergeordnetes Verzeichnis
                    </label>
                    <div className="flex gap-2">
                      <Input
                        id="project-path"
                        placeholder="/pfad/zu/projekten"
                        value={projectPath}
                        onChange={(e) => setProjectPath(e.target.value)}
                        className="flex-1 bg-zinc-950/50 border-white/10 text-white placeholder:text-zinc-500"
                        data-testid="interview-project-path-input"
                      />
                      <Button
                        variant="secondary"
                        onClick={handleSelectDirectory}
                        className="bg-white/5 hover:bg-white/10 text-white border border-white/10"
                        data-testid="interview-browse-directory"
                      >
                        Durchsuchen
                      </Button>
                    </div>
                  </div>

                  {/* Preview of generated spec */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-300">
                      Vorschau der Spezifikation
                    </label>
                    <div
                      className="bg-zinc-950/50 border border-white/10 rounded-md p-3 max-h-48 overflow-y-auto"
                      data-testid="spec-preview"
                    >
                      <pre className="text-xs text-zinc-400 whitespace-pre-wrap font-mono">
                        {generatedSpec}
                      </pre>
                    </div>
                  </div>

                  <Button
                    onClick={handleCreateProject}
                    disabled={!projectName || !projectPath || isGenerating}
                    className="w-full bg-linear-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-600 text-primary-foreground border-0"
                    data-testid="interview-create-project"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Wird erstellt...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Projekt erstellen
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Input */}
      {!isComplete && (
        <div className="border-t p-4">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              placeholder="Gib deine Antwort ein..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isGenerating}
              data-testid="interview-input"
              className="flex-1"
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isGenerating}
              data-testid="interview-send"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
