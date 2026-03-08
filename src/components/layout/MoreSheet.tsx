import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useHaptics } from '@/hooks/useHaptics';
import {
  BookUser,
  FileText,
  StickyNote,
  Flame,
  Heart,
  Utensils,
  Moon,
  Building2,
  Briefcase,
  Newspaper,
  MessageCircle,
  Settings,
  MoreHorizontal,
  Mail,
  CheckSquare,
} from 'lucide-react';

export type MoreSheetPanel =
  | 'contacts' | 'contracts' | 'notes' | 'habits'
  | 'health' | 'family' | 'islam' | 'properties'
  | 'startups' | 'news' | 'social' | 'settings' | 'email' | 'tasks';

interface MoreSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (panel: MoreSheetPanel) => void;
  activePanel?: string;
}

const sections = [
  {
    label: 'Life',
    items: [
      { id: 'health' as const, icon: Heart, labelKey: 'nav.health' },
      { id: 'habits' as const, icon: Flame, labelKey: 'nav.habits' },
      { id: 'family' as const, icon: Utensils, labelKey: 'nav.cooking' },
      { id: 'islam' as const, icon: Moon, labelKey: 'nav.islam' },
    ],
  },
  {
    label: 'Business',
    items: [
      { id: 'email' as const, icon: Mail, labelKey: 'nav.email' },
      { id: 'contacts' as const, icon: BookUser, labelKey: 'nav.contacts' },
      { id: 'contracts' as const, icon: FileText, labelKey: 'nav.contracts' },
      { id: 'properties' as const, icon: Building2, labelKey: 'nav.properties' },
      { id: 'startups' as const, icon: Briefcase, labelKey: 'nav.startups' },
      { id: 'news' as const, icon: Newspaper, labelKey: 'nav.news' },
    ],
  },
  {
    label: 'Tools',
    items: [
      { id: 'tasks' as const, icon: CheckSquare, labelKey: 'nav.tasks' },
      { id: 'notes' as const, icon: StickyNote, labelKey: 'nav.notes' },
      { id: 'social' as const, icon: MessageCircle, labelKey: 'nav.social' },
      { id: 'settings' as const, icon: Settings, labelKey: 'nav.settings' },
    ],
  },
];

const staggerContainer = {
  hidden: { opacity: 1 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.03 },
  },
};

const staggerItem = {
  hidden: { opacity: 0, scale: 0.9 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.2, ease: 'easeOut' } },
};

export function MoreSheet({ open, onOpenChange, onNavigate, activePanel }: MoreSheetProps) {
  const { t } = useLanguage();
  const { vibrate } = useHaptics();

  const handleSelect = (panel: MoreSheetPanel) => {
    vibrate('light');
    onNavigate(panel);
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh] bg-background">
        <div className="mx-auto w-12 h-1.5 rounded-full bg-muted-foreground/20 my-3" />
        <div className="px-4 pb-8 space-y-5">
          {sections.map((section, sIdx) => (
            <div key={section.label}>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
                {section.label}
              </span>
              <motion.div
                className="grid grid-cols-3 gap-2 mt-2"
                variants={staggerContainer}
                initial="hidden"
                animate={open ? 'show' : 'hidden'}
              >
                {section.items.map((item) => {
                  const isActive = activePanel === item.id;
                  return (
                    <motion.button
                      key={item.id}
                      variants={staggerItem}
                      onClick={() => handleSelect(item.id)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all",
                        "active:scale-95 touch-manipulation",
                        "border border-transparent",
                        isActive
                          ? "bg-primary/10 text-primary border-primary/20"
                          : "text-muted-foreground hover:bg-muted glass-card"
                      )}
                    >
                      <item.icon className="w-5 h-5" />
                      <span className="text-xs font-medium truncate w-full text-center">
                        {t(item.labelKey) || item.labelKey.split('.').pop()}
                      </span>
                    </motion.button>
                  );
                })}
              </motion.div>
            </div>
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export { MoreHorizontal as MoreIcon };
