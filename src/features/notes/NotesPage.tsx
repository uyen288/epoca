import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Pin, Plus, Search, Trash2, X } from 'lucide-react';
import { apiRequest, emptyResponseSchema, jsonBody, noteListResponseSchema, noteMutationResponseSchema } from '@/lib/api';
import type { Note, NoteInput } from '@/types';

export function NotesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [editingNote, setEditingNote] = useState<Note | undefined>();
  const [showForm, setShowForm] = useState(false);
  const [deletingNote, setDeletingNote] = useState<Note | undefined>();
  const noteQuery = useQuery({
    queryKey: ['notes', search, tagFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (tagFilter) params.set('tag', tagFilter);
      const queryString = params.toString();
      return apiRequest(`/notes${queryString ? `?${queryString}` : ''}`, noteListResponseSchema);
    },
  });
  const saveMutation = useMutation({
    mutationFn: ({ noteId, input }: { noteId?: string; input: NoteInput }) => apiRequest(
      noteId ? `/notes/${noteId}` : '/notes',
      noteMutationResponseSchema,
      { method: noteId ? 'PATCH' : 'POST', body: jsonBody(input) },
    ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['notes'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);
      setEditingNote(undefined);
      setShowForm(false);
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (noteId: string) => apiRequest(`/notes/${noteId}`, emptyResponseSchema, { method: 'DELETE' }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['notes'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);
      setDeletingNote(undefined);
    },
  });
  const pinMutation = useMutation({
    mutationFn: ({ noteId, isPinned }: { noteId: string; isPinned: boolean }) => apiRequest(
      `/notes/${noteId}`, noteMutationResponseSchema, { method: 'PATCH', body: jsonBody({ isPinned }) },
    ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['notes'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);
    },
  });

  function submitNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get('title') ?? '').trim();
    const content = String(form.get('content') ?? '');
    const tags = String(form.get('tags') ?? '').split(',').map((tag) => tag.trim()).filter(Boolean);
    if (!title) return;
    saveMutation.mutate({ noteId: editingNote?.id, input: { title, content, tags } });
  }

  const notes = noteQuery.data?.items ?? [];
  const availableTags = [...new Set([...notes.flatMap((note) => note.tags), ...(tagFilter ? [tagFilter] : [])])].sort();
  return (
    <section className="page-section">
      <div className="page-heading"><div><span className="eyebrow">THOUGHTS WORTH KEEPING</span><h1>Notes</h1><p>A home for ideas, details, and things you don’t want to forget.</p></div><button className="button button-primary" type="button" onClick={() => { setEditingNote(undefined); setShowForm(true); }}><Plus size={17} /> New note</button></div>
      {(showForm || editingNote) && <form className="editor-panel note-editor" onSubmit={submitNote}>
        <div className="editor-heading"><div><span className="eyebrow">{editingNote ? 'PICK UP THE THREAD' : 'SAVE A THOUGHT'}</span><h2>{editingNote ? 'Edit note' : 'New note'}</h2></div><button className="icon-button" type="button" onClick={() => { setShowForm(false); setEditingNote(undefined); saveMutation.reset(); }} aria-label="Close note form"><X size={18} /></button></div>
        <label className="field"><span>Title</span><input name="title" key={editingNote?.id ?? 'new'} defaultValue={editingNote?.title ?? ''} maxLength={160} required placeholder="Give this thought a name" autoFocus /></label>
        <label className="field"><span>Your note</span><textarea name="content" key={`${editingNote?.id ?? 'new'}-content`} defaultValue={editingNote?.content ?? ''} maxLength={10000} rows={5} placeholder="Start writing…" /></label>
        <label className="field"><span>Tags <small>Separate with commas</small></span><input name="tags" key={`${editingNote?.id ?? 'new'}-tags`} defaultValue={editingNote?.tags.join(', ') ?? ''} placeholder="ideas, personal" /></label>
        {saveMutation.isError && <p className="form-error" role="alert">{saveMutation.error.message}</p>}
        <div className="editor-actions"><button className="button button-quiet" type="button" onClick={() => { setShowForm(false); setEditingNote(undefined); }}>Cancel</button><button className="button button-primary" type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Saving…' : 'Save note'}</button></div>
      </form>}
      <div className="notes-toolbar"><div className="task-search-controls"><label className="search-input"><Search size={17} /><span className="sr-only">Search notes</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search your notes…" /></label><label className="priority-filter"><span className="sr-only">Filter by tag</span><select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}><option value="">All tags</option>{availableTags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}</select></label></div><span className="notes-total">{notes.length} {notes.length === 1 ? 'note' : 'notes'}</span></div>
      {noteQuery.isPending ? <div className="loading-panel"><span className="spinner" />Finding your notes…</div> :
        noteQuery.isError ? <div className="state-card"><h2>Your notes couldn’t be loaded</h2><p>{noteQuery.error.message}</p><button className="button button-secondary" type="button" onClick={() => void noteQuery.refetch()}>Try again</button></div> :
          notes.length === 0 ? <div className="empty-card"><span className="empty-icon"><FileText size={22} /></span><h2>{search || tagFilter ? 'No notes match those filters' : 'A fresh page'}</h2><p>{search || tagFilter ? 'Try another search or clear your filters.' : 'Save the thought before it wanders off.'}</p>{!search && !tagFilter && <button className="button button-secondary" type="button" onClick={() => setShowForm(true)}><Plus size={16} /> Create your first note</button>}</div> :
            <div className="notes-grid">{notes.map((note) => <article className="note-card" key={note.id}>
              <div className="note-card-top"><span className="note-date">{new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(note.updatedAt))}</span><button className={`icon-button pin-button ${note.isPinned ? 'is-pinned' : ''}`} type="button" disabled={pinMutation.isPending} aria-label={note.isPinned ? `Unpin ${note.title}` : `Pin ${note.title}`} onClick={() => pinMutation.mutate({ noteId: note.id, isPinned: !note.isPinned })}><Pin size={16} /></button></div>
              <button className="note-card-content" type="button" onClick={() => { setShowForm(false); setEditingNote(note); }}><h2>{note.title}</h2><p>{note.content || 'A little note to come back to.'}</p></button>
              {note.tags.length > 0 && <div className="tag-list">{note.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div>}
              <div className="note-card-footer"><button type="button" onClick={() => { setShowForm(false); setEditingNote(note); }}>Edit note</button><button className="icon-button delete-button" type="button" aria-label={`Delete ${note.title}`} onClick={() => setDeletingNote(note)}><Trash2 size={15} /></button></div>
            </article>)}</div>}
      {pinMutation.isError && <p className="inline-error" role="alert">{pinMutation.error.message}</p>}
      {deletingNote && <div className="confirm-banner" role="alert"><span>Remove “{deletingNote.title}” from your notes?</span><button className="button button-quiet" type="button" onClick={() => setDeletingNote(undefined)}>Keep note</button><button className="button button-danger" type="button" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(deletingNote.id)}>{deleteMutation.isPending ? 'Removing…' : 'Remove'}</button></div>}
      {deleteMutation.isError && <p className="inline-error" role="alert">{deleteMutation.error.message}</p>}
    </section>
  );
}
