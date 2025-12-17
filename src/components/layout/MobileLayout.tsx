import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { ChatPanel } from '../chat/ChatPanel';
import { TaskList } from '../tasks/TaskList';
import { CalendarPanel } from '../calendar/CalendarPanel';
import { Task, CalendarEvent, ChatMessage } from '@/types/flux';
import { SidebarFilter } from './Sidebar';
import { 
  Menu, 
  MessageSquare, 
  CheckSquare, 
  Calendar, 
  Mic,
  Settings,
  LogOut,
  UserCircle,
  Sparkles,
  LayoutDashboard,
  Briefcase,
  User,
  Users
} from 'lucide-react';

interface MobileLayoutProps {
  tasks: Task[];
  events: CalendarEvent[];
  sharedTasks?: Task[];
  sharedEvents?: CalendarEvent[];
  messages: ChatMessage[];
  isProcessing: boolean;
  onAddTask: (task: Omit<Task, 'id' | 'createdAt'>) => void;
  onToggleTaskComplete: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onDeleteTasks?: (ids: string[]) => Promise<{ error: string | null }> | void;
  onUpdateTask?: (id: string, updates: Partial<Task>) => void;
  onReorderTasks?: (taskOrders: { id: string; sortOrder: number }[]) => void;
  onAddEvent: (event: Omit<CalendarEvent, 'id'>) => void;
  onUpdateEvent?: (id: string, updates: Partial<CalendarEvent>) => void;
  onDeleteEvent?: (id: string) => void;
  onImportEvents?: (events: CalendarEvent[]) => void;
  onSendMessage: (content: string) => void;
  onVoiceMode: () => void;
  onOpenSettings: () => void;
  onEditProfile?: () => void;
  onShareTask?: (id: string, title: string) => void;
  onShareEvent?: (id: string, title: string) => void;
  onSignOut?: () => void;
}

type Tab = 'chat' | 'tasks' | 'calendar';

export function MobileLayout({
  tasks,
  events,
  sharedTasks = [],
  sharedEvents = [],
  messages,
  isProcessing,
  onAddTask,
  onToggleTaskComplete,
  onDeleteTask,
  onDeleteTasks,
  onUpdateTask,
  onReorderTasks,
  onAddEvent,
  onUpdateEvent,
  onDeleteEvent,
  onImportEvents,
  onSendMessage,
  onVoiceMode,
  onOpenSettings,
  onEditProfile,
  onShareTask,
  onShareEvent,
  onSignOut,
}: MobileLayoutProps) {
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [filter, setFilter] = useState<SidebarFilter>('all');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Get tasks/events based on current filter
  const displayTasks = filter === 'shared' ? sharedTasks : tasks;
  const displayEvents = filter === 'shared' ? sharedEvents : events;

  const tabs = [
    { id: 'chat' as Tab, icon: MessageSquare, label: 'Chat' },
    { id: 'tasks' as Tab, icon: CheckSquare, label: 'Tasks' },
    { id: 'calendar' as Tab, icon: Calendar, label: 'Calendar' },
  ];

  const navItems: { icon: typeof LayoutDashboard; label: string; filter: SidebarFilter }[] = [
    { icon: LayoutDashboard, label: 'All Tasks', filter: 'all' },
    { icon: Briefcase, label: 'Business', filter: 'business' },
    { icon: User, label: 'Personal', filter: 'personal' },
    { icon: Users, label: 'Shared with me', filter: 'shared' },
  ];

  return (
    <div className="flex flex-col h-screen w-full bg-background">
      {/* Header */}
      <header className="h-14 px-4 flex items-center justify-between border-b border-border bg-background shrink-0">
        <div className="flex items-center gap-3">
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <div className="flex flex-col h-full">
                {/* Logo */}
                <div className="h-16 flex items-center px-4 border-b border-border">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <span className="font-semibold text-lg">Flux</span>
                  </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-3 space-y-1">
                  {navItems.map((item) => (
                    <Button
                      key={item.filter}
                      variant={filter === item.filter ? 'secondary' : 'ghost'}
                      className="w-full justify-start gap-3"
                      onClick={() => {
                        setFilter(item.filter);
                        setActiveTab('tasks');
                        setSidebarOpen(false);
                      }}
                    >
                      <item.icon className="w-5 h-5 shrink-0" />
                      <span>{item.label}</span>
                    </Button>
                  ))}
                </nav>

                {/* Bottom Actions */}
                <div className="p-3 border-t border-border space-y-1">
                  {onEditProfile && (
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-3"
                      onClick={() => {
                        onEditProfile();
                        setSidebarOpen(false);
                      }}
                    >
                      <UserCircle className="w-5 h-5 shrink-0" />
                      <span>Edit Profile</span>
                    </Button>
                  )}
                  
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3"
                    onClick={() => {
                      onOpenSettings();
                      setSidebarOpen(false);
                    }}
                  >
                    <Settings className="w-5 h-5 shrink-0" />
                    <span>Settings</span>
                  </Button>
                  
                  <Button
                    variant="voice_mode"
                    className="w-full justify-start gap-3"
                    onClick={() => {
                      onVoiceMode();
                      setSidebarOpen(false);
                    }}
                  >
                    <Mic className="w-5 h-5 shrink-0" />
                    <span>Voice Mode</span>
                  </Button>

                  {onSignOut && (
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        onSignOut();
                        setSidebarOpen(false);
                      }}
                    >
                      <LogOut className="w-5 h-5 shrink-0" />
                      <span>Sign Out</span>
                    </Button>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold">Flux</span>
          </div>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onVoiceMode}
          className="text-primary hover:text-primary hover:bg-primary/10"
        >
          <Mic className="w-5 h-5" />
        </Button>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-hidden">
        <div className={cn(
          "h-full",
          activeTab === 'chat' ? 'block' : 'hidden'
        )}>
          <ChatPanel 
            messages={messages}
            onSendMessage={onSendMessage}
            isProcessing={isProcessing}
          />
        </div>
        <div className={cn(
          "h-full",
          activeTab === 'tasks' ? 'block' : 'hidden'
        )}>
          <TaskList
            tasks={displayTasks}
            filter={filter}
            onToggleComplete={onToggleTaskComplete}
            onDeleteTask={onDeleteTask}
            onDeleteTasks={onDeleteTasks}
            onAddTask={onAddTask}
            onUpdateTask={onUpdateTask}
            onReorderTasks={onReorderTasks}
            onShareTask={onShareTask}
          />
        </div>
        <div className={cn(
          "h-full",
          activeTab === 'calendar' ? 'block' : 'hidden'
        )}>
          <CalendarPanel
            events={displayEvents}
            tasks={displayTasks}
            onAddEvent={onAddEvent}
            onUpdateEvent={onUpdateEvent}
            onDeleteEvent={onDeleteEvent}
            onImportEvents={onImportEvents}
            onShareEvent={onShareEvent}
            onShareTask={onShareTask}
            onToggleTaskComplete={onToggleTaskComplete}
            onUpdateTask={onUpdateTask}
            onDeleteTask={onDeleteTask}
          />
        </div>
      </main>

      {/* Bottom Tab Bar */}
      <nav className="h-16 border-t border-border bg-background flex items-center justify-around shrink-0 safe-area-bottom">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors",
              activeTab === tab.id 
                ? "text-primary" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="w-5 h-5" />
            <span className="text-xs font-medium">{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
