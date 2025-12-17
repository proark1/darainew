import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ArrowLeft, UserPlus, Trash2, Search, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Contact {
  id: string;
  contactUserId: string;
  nickname: string | null;
  email: string;
  displayName: string | null;
}

export default function Contacts() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [adding, setAdding] = useState(false);

  const fetchContacts = async () => {
    if (!user) return;
    
    setLoading(true);
    const { data: contactsData } = await supabase
      .from('user_contacts')
      .select('id, contact_user_id, nickname')
      .eq('user_id', user.id);

    if (contactsData && contactsData.length > 0) {
      const contactUserIds = contactsData.map(c => c.contact_user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, email, display_name')
        .in('user_id', contactUserIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      setContacts(contactsData.map(c => {
        const profile = profileMap.get(c.contact_user_id);
        return {
          id: c.id,
          contactUserId: c.contact_user_id,
          nickname: c.nickname,
          email: profile?.email || '',
          displayName: profile?.display_name || null,
        };
      }));
    } else {
      setContacts([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchContacts();
  }, [user]);

  const addContact = async () => {
    if (!user || !email.trim()) return;

    setAdding(true);
    const normalizedEmail = email.trim().toLowerCase();

    // Find user by email
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, email, display_name')
      .ilike('email', normalizedEmail)
      .maybeSingle();

    if (profileError || !profile) {
      toast({
        title: 'User not found',
        description: `No account found with email "${email}". Make sure they have registered.`,
        variant: 'destructive',
      });
      setAdding(false);
      return;
    }

    if (profile.user_id === user.id) {
      toast({
        title: 'Invalid contact',
        description: "You can't add yourself as a contact.",
        variant: 'destructive',
      });
      setAdding(false);
      return;
    }

    // Check if already a contact
    const existing = contacts.find(c => c.contactUserId === profile.user_id);
    if (existing) {
      toast({
        title: 'Already a contact',
        description: `${profile.email} is already in your contacts.`,
        variant: 'destructive',
      });
      setAdding(false);
      return;
    }

    const { error } = await supabase
      .from('user_contacts')
      .insert({
        user_id: user.id,
        contact_user_id: profile.user_id,
      });

    if (error) {
      toast({
        title: 'Failed to add contact',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Contact added',
        description: `${profile.display_name || profile.email} has been added to your contacts.`,
      });
      setEmail('');
      fetchContacts();
    }
    setAdding(false);
  };

  const removeContact = async (contactId: string, contactName: string) => {
    const { error } = await supabase
      .from('user_contacts')
      .delete()
      .eq('id', contactId);

    if (error) {
      toast({
        title: 'Failed to remove contact',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Contact removed',
        description: `${contactName} has been removed from your contacts.`,
      });
      setContacts(prev => prev.filter(c => c.id !== contactId));
    }
  };

  const filteredContacts = contacts.filter(c => {
    const query = searchQuery.toLowerCase();
    return (
      c.email.toLowerCase().includes(query) ||
      c.displayName?.toLowerCase().includes(query) ||
      c.nickname?.toLowerCase().includes(query)
    );
  });

  const getInitials = (contact: Contact) => {
    if (contact.displayName) {
      return contact.displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return contact.email[0].toUpperCase();
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="mb-6 gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Button>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Contacts
            </CardTitle>
            <CardDescription>
              Manage your contacts for easy sharing of tasks and events
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="Enter email address..."
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addContact()}
                type="email"
              />
              <Button onClick={addContact} disabled={adding || !email.trim()} className="gap-2">
                <UserPlus className="w-4 h-4" />
                Add
              </Button>
            </div>
          </CardContent>
        </Card>

        {contacts.length > 0 && (
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        )}

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading contacts...
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {searchQuery ? 'No contacts match your search.' : 'No contacts yet. Add someone to get started!'}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredContacts.map((contact) => (
              <Card key={contact.id} className="hover:bg-accent/50 transition-colors">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {getInitials(contact)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">
                        {contact.displayName || contact.email}
                      </p>
                      {contact.displayName && (
                        <p className="text-sm text-muted-foreground">{contact.email}</p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeContact(contact.id, contact.displayName || contact.email)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
