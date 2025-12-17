import { useEffect, useRef, useCallback } from 'react';
import { Contact } from './useContacts';
import { Task } from '@/types/flux';
import { isPast, isToday, isTomorrow, format } from 'date-fns';

interface UseContactRemindersProps {
  contacts: Contact[];
  tasks: Task[];
  onAddTask: (task: Omit<Task, 'id' | 'createdAt'>) => void;
  enabled?: boolean;
}

// Generate a consistent task title for a contact reminder
const getContactReminderTitle = (contact: Contact): string => {
  const action = contact.contactType === 'personal' ? 'Reach out to' : 'Follow up with';
  return `${action} ${contact.name}`;
};

// Check if a reminder task already exists for this contact
const hasExistingReminder = (contact: Contact, tasks: Task[]): boolean => {
  const expectedTitle = getContactReminderTitle(contact);
  return tasks.some(task => 
    !task.completed && 
    task.title.includes(contact.name) &&
    (task.title.includes('Reach out') || task.title.includes('Follow up'))
  );
};

export function useContactReminders({
  contacts,
  tasks,
  onAddTask,
  enabled = true,
}: UseContactRemindersProps) {
  const hasCheckedRef = useRef(false);

  const createContactReminders = useCallback(() => {
    if (!enabled || contacts.length === 0) return;

    const now = new Date();
    const createdReminders: string[] = [];

    for (const contact of contacts) {
      // Skip if no due date or not due yet
      if (!contact.nextContactDue) continue;
      
      // Check if due (today, past, or tomorrow for advance notice)
      const isDue = isPast(contact.nextContactDue) || 
                    isToday(contact.nextContactDue) || 
                    isTomorrow(contact.nextContactDue);
      
      if (!isDue) continue;

      // Skip if reminder already exists
      if (hasExistingReminder(contact, tasks)) continue;

      // Create the reminder task
      const title = getContactReminderTitle(contact);
      const tierLabel = contact.personalTier || contact.businessLevel || '';
      const tierText = tierLabel ? ` (${tierLabel.replace('_', ' ')})` : '';
      
      let description = `Time to connect with ${contact.name}${tierText}.`;
      if (contact.notes) {
        description += `\n\nNotes: ${contact.notes}`;
      }
      if (contact.phone) {
        description += `\n📞 ${contact.phone}`;
      }
      if (contact.email) {
        description += `\n✉️ ${contact.email}`;
      }

      // Set priority based on relationship
      let priority: 'low' | 'medium' | 'high' = 'medium';
      if (contact.personalTier === 'family') {
        priority = 'high';
      } else if (contact.personalTier === 'close_friend' || contact.businessLevel === 'very_well') {
        priority = 'high';
      } else if (contact.personalTier === 'acquaintance' || contact.businessLevel === 'barely') {
        priority = 'low';
      }

      // Due date is the contact's next due date (or today if past)
      const dueDate = isPast(contact.nextContactDue) ? now : contact.nextContactDue;

      onAddTask({
        title,
        description,
        completed: false,
        priority,
        category: contact.contactType === 'personal' ? 'personal' : 'business',
        dueDate,
      });

      createdReminders.push(contact.name);
    }

    return createdReminders;
  }, [contacts, tasks, onAddTask, enabled]);

  // Run once on mount (after contacts and tasks are loaded)
  useEffect(() => {
    if (hasCheckedRef.current) return;
    if (contacts.length === 0) return;
    
    // Small delay to ensure tasks are loaded
    const timer = setTimeout(() => {
      hasCheckedRef.current = true;
      createContactReminders();
    }, 2000);

    return () => clearTimeout(timer);
  }, [contacts.length, createContactReminders]);

  // Manual trigger for refresh
  const checkAndCreateReminders = useCallback(() => {
    hasCheckedRef.current = false;
    return createContactReminders();
  }, [createContactReminders]);

  return {
    checkAndCreateReminders,
  };
}
