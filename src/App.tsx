import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import {
  ArrowDownToLine, ArrowLeft, ArrowUpRight, CalendarDays, Check, ChevronDown,
  Cloud, Copy, FileText, ImagePlus, Instagram, LogOut, MoreHorizontal,
  PenLine, Plus, Settings2, Trash2, Upload,
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { readDrafts, writeDrafts } from './lib/storage';
import { getPlatformReadiness } from './lib/posting';
import { freshDraft, platformNames } from './types';
import type { Page, Platform, PostDraft } from './types';

const platforms: Platform[] = ['instagram', 'x', 'substack'];
const labelFor: Record<Platform, string> = { instagram: 'Instagram', x: 'X', substack: 'Substack Notes' };
const summaryFor = (draft: PostDraft) => draft.text[draft.platforms[0] ?? 'instagram'] || 'Untitled draft';
type Connection = { platform: Platform; username?: string; expires_at?: string };

export default function App() {
  const [page, setPage] = useState<Page>('compose');
  const [drafts, setDrafts] = useState<PostDraft[]>(readDrafts);
  const [draftSearch, setDraftSearch] = useState('');
  const [draftPlatformFilter, setDraftPlatformFilter] = useState<Platform | 'all'>('all');
  const [draft, setDraft] = useState<PostDraft>(freshDraft);
  const [activePlatform, setActivePlatform] = useState<Platform>('instagram');
  const [previewPlatform, setPreviewPlatform] = useState<Platform>('instagram');
  const [toast, setToast] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'in' | 'up'>('in');
  const [syncMessage, setSyncMessage] = useState('Saved on this device');
  const [authBusy, setAuthBusy] = useState(false);
  const [publishReview, setPublishReview] = useState<Platform | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [instagramFrame, setInstagramFrame] = useState<'original' | 'square' | 'portrait'>('portrait');
  const editorRef = useRef<HTMLTextAreaElement>(null);

  const visibleText = draft.text[activePlatform];
  const previewText = draft.text[previewPlatform];
  const scheduled = useMemo(
    () => drafts.filter((item) => item.scheduledAt).sort((a, b) => (a.scheduledAt ?? '').localeCompare(b.scheduledAt ?? '')),
    [drafts],
  );
  const filteredDrafts = useMemo(() => {
    const query = draftSearch.trim().toLocaleLowerCase();
    return drafts
      .filter((item) => draftPlatformFilter === 'all' || item.platforms.includes(draftPlatformFilter))
      .filter((item) => !query || [item.title, ...platforms.map((platform) => item.text[platform])].some((value) => value.toLocaleLowerCase().includes(query)))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [drafts, draftPlatformFilter, draftSearch]);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !supabase) { setConnections([]); return; }
    supabase.functions.invoke('platform-connections').then(({ data, error }) => {
      if (error) { setSyncMessage('Cloud backup connected · publisher setup needed'); return; }
      setConnections((data?.connections ?? []) as Connection[]);
    });
  }, [user]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get('postroom_connection');
    if (result) setPage('settings');
    if (result === 'connected') setToast(`${params.get('platform') === 'instagram' ? 'Instagram' : 'X'} connected for direct publishing`);
    if (result === 'error') setToast(`Account connection failed: ${params.get('reason') ?? 'try again'}`);
    if (result) { params.delete('postroom_connection'); params.delete('platform'); params.delete('reason'); const clean = `${window.location.pathname}${params.size ? `?${params}` : ''}${window.location.hash}`; window.history.replaceState({}, '', clean); }
  }, []);

  useEffect(() => {
    if (!user || !supabase) return;
    let cancelled = false;
    setSyncMessage('Syncing cloud drafts…');
    supabase.from('postroom_drafts').select('draft').eq('user_id', user.id).then(({ data, error }) => {
      if (cancelled) return;
      if (error) { setSyncMessage('Cloud sync needs database setup'); return; }
      const remote = (data ?? []).map((row) => row.draft as PostDraft);
      setDrafts((local) => {
        const merged = [...remote];
        for (const item of local) if (!merged.some((candidate) => candidate.id === item.id)) merged.push(item);
        try { writeDrafts(merged); } catch { /* The Supabase copy remains available. */ }
        return merged;
      });
      setSyncMessage('Cloud backup connected');
    });
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    const hasContent = draft.title.trim() || platforms.some((platform) => draft.text[platform].trim()) || draft.media || draft.scheduledAt;
    if (!hasContent) return;
    const timeout = window.setTimeout(() => {
      const updated = draft;
      setDrafts((current) => {
        const index = current.findIndex((item) => item.id === updated.id);
        const next = [...current];
        if (index >= 0) next[index] = updated;
        else next.unshift(updated);
        try { writeDrafts(next); setSyncMessage(user ? 'Saved · syncing to cloud' : 'Autosaved on this device'); }
        catch { setSyncMessage('Browser storage full · export a backup'); }
        if (user && supabase) {
          supabase.from('postroom_drafts').upsert({ id: updated.id, user_id: user.id, draft: updated, updated_at: updated.updatedAt })
            .then(({ error }) => setSyncMessage(error ? 'Local save · cloud sync needs setup' : 'Saved on this device and cloud'));
        }
        return next;
      });
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [draft, user]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(''), 2800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  function patchDraft(patch: Partial<PostDraft>) {
    setDraft((current) => ({ ...current, ...patch, updatedAt: new Date().toISOString() }));
  }

  function setPlatformText(platform: Platform, text: string) {
    setDraft((current) => ({ ...current, text: { ...current.text, [platform]: text }, updatedAt: new Date().toISOString() }));
  }

  function togglePlatform(platform: Platform) {
    const selected = draft.platforms.includes(platform);
    const next = selected ? draft.platforms.filter((item) => item !== platform) : [...draft.platforms, platform];
    if (!next.length) { setToast('Choose at least one place to post'); return; }
    patchDraft({ platforms: next });
    if (!selected) setPreviewPlatform(platform);
  }

  function newDraft() {
    setDraft(freshDraft()); setPage('compose'); setActivePlatform('instagram'); setPreviewPlatform('instagram');
  }

  function openDraft(item: PostDraft) {
    setDraft(item); setActivePlatform(item.platforms[0] ?? 'instagram'); setPreviewPlatform(item.platforms[0] ?? 'instagram'); setPage('compose');
  }

  function removeDraft(id: string) {
    const next = drafts.filter((item) => item.id !== id);
    setDrafts(next); writeDrafts(next);
    if (draft.id === id) newDraft();
    if (user && supabase) supabase.from('postroom_drafts').delete().eq('id', id).eq('user_id', user.id);
    setToast('Draft deleted');
  }

  function duplicateDraft(item: PostDraft) {
    const copy: PostDraft = {
      ...item,
      id: crypto.randomUUID(),
      title: item.title ? `${item.title} (copy)` : `${summaryFor(item).split('\n')[0].slice(0, 48) || 'Untitled draft'} (copy)`,
      text: { ...item.text },
      platforms: [...item.platforms],
      media: item.media ? { ...item.media } : undefined,
      updatedAt: new Date().toISOString(),
    };
    const next = [copy, ...drafts];
    setDrafts(next);
    try { writeDrafts(next); } catch { setSyncMessage('Browser storage full · export a backup'); }
    if (user && supabase) {
      supabase.from('postroom_drafts').upsert({ id: copy.id, user_id: user.id, draft: copy, updated_at: copy.updatedAt })
        .then(({ error }) => { if (error) setSyncMessage('Local save · cloud sync needs setup'); });
    }
    setToast('Draft duplicated');
  }

  async function copyText(text: string) {
    try { await navigator.clipboard.writeText(text); setToast('Copied to clipboard'); }
    catch { setToast('Clipboard access unavailable · select and copy the text'); }
  }

  async function publishHandoff(platform: Platform) {
    const text = draft.text[platform];
    if (!text.trim() && !draft.media) { setToast('Write something before opening a platform'); return; }
    if (platform === 'x' && text.length > 280) { setToast('This X post is over 280 characters'); return; }
    const url = platform === 'x'
      ? `https://x.com/intent/post?text=${encodeURIComponent(text)}`
      : platform === 'substack' ? 'https://substack.com/notes' : 'https://www.instagram.com/';
    window.open(url, '_blank', 'noopener,noreferrer');
    try { if (text) await navigator.clipboard.writeText(text); setToast(`${platformNames[platform]} opened · text copied`); }
    catch { setToast(`${platformNames[platform]} opened · copy the text from Postroom`); }
  }

  async function connectPlatform(platform: Platform) {
    if (platform === 'substack') { setToast('Substack Notes has no supported direct-publishing connection yet'); return; }
    if (!supabase) { setToast('Add Supabase settings first to enable secure API connections'); setPage('settings'); return; }
    if (!user) { setToast('Sign in to Supabase before connecting a platform account'); setPage('settings'); return; }
    setToast(`Connecting ${labelFor[platform]}…`);
    const { data, error } = await supabase.functions.invoke('platform-oauth-start', { body: { platform } });
    if (error || !data?.url) { setToast(data?.error ?? error?.message ?? 'Connection service is not deployed'); return; }
    window.location.assign(data.url as string);
  }

  async function disconnectPlatform(platform: Platform) {
    if (!supabase) return;
    const { error } = await supabase.functions.invoke('platform-connections', { body: { action: 'disconnect', platform } });
    if (error) { setToast(error.message); return; }
    setConnections((current) => current.filter((item) => item.platform !== platform));
    setToast(`${labelFor[platform]} disconnected`);
  }

  async function publishDirect(platform: Platform) {
    if (!supabase || !user) { setToast('Sign in and configure Supabase to publish directly'); return; }
    const text = draft.text[platform]?.trim() ?? '';
    if (platform === 'x' && text.length > 280) { setToast('This X post is over 280 characters'); return; }
    if (platform === 'x' && draft.media) { setToast('Direct X publishing currently supports text only · use the handoff for images'); return; }
    if (platform === 'instagram' && !draft.media) { setToast('Instagram direct publishing needs an image'); return; }
    setToast(`Publishing to ${labelFor[platform]}…`);
    const { data, error } = await supabase.functions.invoke('platform-publish', { body: { platform, text, media: draft.media?.dataUrl, mediaName: draft.media?.name } });
    if (error || data?.error) { setToast(data?.error ?? error?.message ?? 'Publishing failed'); return; }
    setToast(`${labelFor[platform]} published`);
  }

  function downloadMedia() {
    if (!draft.media) return;
    const link = document.createElement('a'); link.href = draft.media.dataUrl; link.download = draft.media.name || 'postroom-image'; link.click();
  }

  function handleImage(file?: File) {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setToast('Choose a JPEG, PNG, or WebP image'); return; }
    if (file.size > 1_500_000) { setToast('Choose an image under 1.5 MB for local storage'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const image = new Image();
      image.onload = () => patchDraft({ media: { name: file.name, dataUrl, sizeBytes: file.size, width: image.naturalWidth, height: image.naturalHeight } });
      image.onerror = () => setToast('Could not read that image');
      image.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  function insertWritingCue(cue: string) {
    const editor = editorRef.current;
    const current = draft.text[activePlatform];
    const start = editor?.selectionStart ?? current.length;
    const end = editor?.selectionEnd ?? current.length;
    const before = current.slice(0, start);
    const after = current.slice(end);
    const prefix = before && !/\s$/.test(before) && !/^\s/.test(cue) ? '\n\n' : '';
    const suffix = after && !/^\s/.test(after) && !/\s$/.test(cue) ? '\n\n' : '';
    const insertion = `${prefix}${cue}${suffix}`;
    const next = `${before}${insertion}${after}`;
    setPlatformText(activePlatform, next);
    requestAnimationFrame(() => {
      editorRef.current?.focus();
      const cursor = start + insertion.length;
      editorRef.current?.setSelectionRange(cursor, cursor);
    });
  }

  function readinessFor(platform: Platform) {
    return getPlatformReadiness(platform, draft, connections.map((item) => item.platform));
  }

  function beginPublish(platform: Platform) {
    const readiness = readinessFor(platform);
    if (readiness.status === 'Needs a fix') { setToast(readiness.detail); setActivePlatform(platform); setPreviewPlatform(platform); return; }
    if (readiness.directAvailable) {
      setPublishReview(platform);
      return;
    }
    void publishHandoff(platform);
  }

  async function confirmPublish() {
    if (!publishReview) return;
    const platform = publishReview;
    setIsPublishing(true);
    try {
      await publishDirect(platform);
      setPublishReview(null);
    } catch {
      setToast('Publishing could not be completed · your draft is still saved');
    } finally {
      setIsPublishing(false);
    }
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify({ version: 1, drafts }, null, 2)], { type: 'application/json' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'postroom-backup.json'; link.click(); URL.revokeObjectURL(link.href);
  }

  function importBackup(file?: File) {
    if (!file) return;
    file.text().then((raw) => {
      const parsed = JSON.parse(raw) as { drafts?: PostDraft[] };
      if (!Array.isArray(parsed.drafts)) throw new Error('Invalid backup');
      const merged = [...drafts];
      for (const item of parsed.drafts) if (!merged.some((existing) => existing.id === item.id)) merged.push(item);
      setDrafts(merged); writeDrafts(merged); setToast('Backup imported');
    }).catch(() => setToast('Could not read that Postroom backup'));
  }

  async function submitAuth(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setAuthBusy(true);
    const result = authMode === 'in'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
    setAuthBusy(false);
    if (result.error) setToast(result.error.message);
    else setToast(authMode === 'in' ? 'Signed in · cloud backup is connecting' : 'Account created · check your email if confirmation is enabled');
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    setUser(null); setSyncMessage('Saved on this device'); setToast('Signed out · local drafts stay here');
  }

  const pageMeta: Record<Page, { title: string; subtitle: string; crumb: string }> = {
    compose: { title: 'Write. Then get back to life.', subtitle: 'Prepare a post, then hand it to the platform to publish.', crumb: 'Compose' },
    drafts: { title: 'Your words, saved.', subtitle: 'Drafts are stored on this device, unless you enable cloud backup.', crumb: 'Drafts' },
    calendar: { title: 'Plan your next post.', subtitle: 'A simple list of planned posts. Publishing still happens in each platform.', crumb: 'Planner' },
    settings: { title: 'Keep it yours.', subtitle: 'Your writing stays private and under your control.', crumb: 'Settings' },
  };
  const wordCount = visibleText.trim() ? visibleText.trim().split(/\s+/).length : 0;
  const lineCount = visibleText ? visibleText.split('\n').length : 0;
  const longSentenceCount = visibleText.split(/[.!?]+/).filter((sentence) => sentence.trim().split(/\s+/).filter(Boolean).length > 24).length;

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">p</span><span>postroom</span></div>
      <div className="side-label">YOUR DESK</div>
      <nav className="side-nav" aria-label="Main navigation">
        <SideButton icon={<PenLine />} label="Compose" active={page === 'compose'} onClick={() => setPage('compose')} />
        <SideButton icon={<FileText />} label="Drafts" count={drafts.length} active={page === 'drafts'} onClick={() => setPage('drafts')} />
        <SideButton icon={<CalendarDays />} label="Planner" count={scheduled.length || undefined} active={page === 'calendar'} onClick={() => setPage('calendar')} />
      </nav>
      <div className="side-rule" />
      <div className="side-label">POST TO</div>
      {platforms.map((platform) => <div className="side-platform" key={platform}><PlatformMark platform={platform} /><span>{labelFor[platform]}</span><span className="manual">{connections.some((item) => item.platform === platform) ? 'CONNECTED' : 'HANDOFF'}</span></div>)}
      <div className="sidebar-bottom"><div className="quiet-note">No feeds. No scrolling.<br />Just your next post.</div><button className="side-button" onClick={() => setPage('settings')}><Settings2 size={16} /> Settings</button></div>
    </aside>

    <main className="main-area">
      <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> <b>{pageMeta[page].crumb}</b></div><div className="privacy-chip"><span />{user ? 'CLOUD BACKUP ON' : 'PRIVATE · THIS DEVICE'}</div></header>
      <div className="page-heading"><div><div className="eyebrow">YOUR PUBLISHING DESK</div><h1>{pageMeta[page].title}</h1><p>{pageMeta[page].subtitle}</p></div>{page === 'compose' && <div className="save-indicator"><span className="save-dot" />{syncMessage}</div>}</div>

      {page === 'compose' && <div className="compose-grid">
        <section className="panel compose-panel">
          <div className="panel-heading"><h2>New post</h2><span className="tiny-label">01 — COMPOSE</span></div>
          <label className="draft-title-field" htmlFor="draft-title"><span>Working title <small>Optional · helps you find this draft later</small></span><input id="draft-title" value={draft.title} onChange={(event) => patchDraft({ title: event.target.value })} placeholder="Name this idea" /></label>
          <div className="field-label">Choose destinations</div>
          <div className="platform-pills">{platforms.map((platform) => <button key={platform} className={`platform-pill ${draft.platforms.includes(platform) ? 'selected' : ''}`} onClick={() => togglePlatform(platform)} aria-pressed={draft.platforms.includes(platform)}><span className="check-box">{draft.platforms.includes(platform) && <Check size={11} />}</span><PlatformMark platform={platform} />{labelFor[platform]}</button>)}</div>
          <div className="editor-tabs" role="tablist" aria-label="Platform versions">{draft.platforms.map((platform) => <button key={platform} role="tab" aria-selected={activePlatform === platform} className={activePlatform === platform ? 'active' : ''} onClick={() => { setActivePlatform(platform); setPreviewPlatform(platform); }}>{labelFor[platform]}</button>)}</div>
          <div className="field-row"><label className="field-label" htmlFor="post-copy">Your {activePlatform === 'substack' ? 'Note' : activePlatform === 'instagram' ? 'Instagram caption' : 'X post'}</label>{activePlatform === 'x' && <span className={`char-count ${visibleText.length > 280 ? 'over' : ''}`}>{visibleText.length} / 280</span>}</div>
          <div className="text-area-wrap"><textarea ref={editorRef} id="post-copy" value={visibleText} onChange={(event) => setPlatformText(activePlatform, event.target.value)} placeholder={activePlatform === 'substack' ? 'A thought worth sharing…' : activePlatform === 'instagram' ? 'Start with the line you want people to notice…' : 'What would you like to share?'} maxLength={activePlatform === 'x' ? 5000 : undefined} /></div>
          <div className="writing-stats"><span>{visibleText.length} characters</span><span>{wordCount} {wordCount === 1 ? 'word' : 'words'}</span><span>{lineCount} {lineCount === 1 ? 'line' : 'lines'}</span>{activePlatform === 'instagram' && longSentenceCount > 0 && <span className="writing-hint">{longSentenceCount} long {longSentenceCount === 1 ? 'sentence' : 'sentences'} to review</span>}</div>
          {activePlatform === 'instagram' && <details className="writing-toolbox"><summary>Caption toolkit <ChevronDown size={14} /></summary><p>Optional cues. Insert at the cursor, then write in your own voice.</p><div className="cue-buttons"><button type="button" onClick={() => insertWritingCue('Opening line')}>Opening line</button><button type="button" onClick={() => insertWritingCue('\n\nMain thought')}>Main thought</button><button type="button" onClick={() => insertWritingCue('\n\nWhat should the reader do next?')}>Call to action</button><button type="button" onClick={() => insertWritingCue('\n\n#')}>Hashtag block</button></div><div className="toolkit-note">Local check: keep the first line clear, break up long paragraphs, and include only the parts that fit this post.</div></details>}
          <div className="editor-tools"><label className="button button-light upload-button"><ImagePlus size={15} />{draft.media ? 'Replace image' : 'Add image'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => handleImage(event.target.files?.[0])} /></label><span className="helper-text">JPEG, PNG, or WebP · up to 1.5 MB · kept with this draft on your device.</span><button className="icon-button" title="Copy this version" onClick={() => void copyText(visibleText)}><Copy size={15} /></button></div>
          {draft.media && <div className="media-preview"><img src={draft.media.dataUrl} alt="Selected post media" /><div className="media-caption"><span>{draft.media.name}<small>{draft.media.width && draft.media.height ? ` · ${draft.media.width} × ${draft.media.height}` : ''}{draft.media.sizeBytes ? ` · ${(draft.media.sizeBytes / 1024).toFixed(0)} KB` : ''}</small></span><div><button className="text-button" onClick={downloadMedia}><ArrowDownToLine size={14} /> Download</button><button className="text-button danger" onClick={() => patchDraft({ media: undefined })}><Trash2 size={14} /> Remove</button></div></div></div>}
          <div className="editor-divider" />
          <details className="schedule-details"><summary><CalendarDays size={16} /><span>Plan for later</span><ChevronDown size={15} /></summary><div className="schedule-fields"><label>Publish date and time<input type="datetime-local" value={draft.scheduledAt ? draft.scheduledAt.slice(0, 16) : ''} onChange={(event) => patchDraft({ scheduledAt: event.target.value ? new Date(event.target.value).toISOString() : undefined })} /></label><p>This is a reminder in your planner only. The app can’t publish in the background without platform authorization.</p></div></details>
          <div className="editor-footer"><span className="autosave-note"><span className="save-dot" />Autosaves as you write</span><span className="editor-footer-hint">Switch platforms to tailor each version.</span></div>
        </section>

        <div className="right-rail">
          <section className="panel readiness-panel"><div className="preview-heading"><div><h2>Ready to post?</h2><p className="panel-subtitle">Select a destination to edit its version and review its checklist.</p></div></div><div className="readiness-list">{draft.platforms.map((platform) => { const result = readinessFor(platform); return <button key={platform} className={`readiness-row ${activePlatform === platform ? 'readiness-active' : ''} ${result.status === 'Needs a fix' ? 'readiness-error' : result.status === 'Review' ? 'readiness-review' : ''}`} onClick={() => { setActivePlatform(platform); setPreviewPlatform(platform); }}><span className="readiness-dot" /><span className="readiness-copy"><b>{labelFor[platform]}</b><small>{result.detail}</small></span><span className="readiness-status">{result.status}</span></button>; })}</div><div className="readiness-action"><div className="readiness-action-label"><PlatformMark platform={activePlatform} /><span>Next step</span><b>{labelFor[activePlatform]}</b></div><button className="button button-primary readiness-continue" onClick={() => beginPublish(activePlatform)}>{readinessFor(activePlatform).directAvailable ? <>Review & publish <ArrowUpRight size={15} /></> : <>Open {activePlatform === 'substack' ? 'Notes' : labelFor[activePlatform]} <ArrowUpRight size={15} /></>}</button><details className="other-destinations"><summary>Continue with another destination</summary><div className="handoff-list">{draft.platforms.filter((platform) => platform !== activePlatform).map((platform) => <button key={platform} onClick={() => beginPublish(platform)}><span><PlatformMark platform={platform} />Open {platform === 'substack' ? 'Notes' : labelFor[platform]}</span><ArrowUpRight size={15} /></button>)}</div></details><div className="safe-note">X opens with text prefilled. Instagram and Substack Notes open separately; your text is copied for pasting.</div></div></section>
          <section className="panel preview-panel"><div className="preview-heading"><h2>Preview</h2><div className="preview-switch">{draft.platforms.map((platform) => <button key={platform} className={previewPlatform === platform ? 'active' : ''} onClick={() => setPreviewPlatform(platform)}>{platform === 'instagram' ? 'IG' : platform === 'substack' ? 'Notes' : 'X'}</button>)}</div></div>{previewPlatform === 'instagram' && draft.media && <div className="frame-control"><label htmlFor="instagram-frame">Image frame</label><select id="instagram-frame" value={instagramFrame} onChange={(event) => setInstagramFrame(event.target.value as 'original' | 'square' | 'portrait')}><option value="portrait">Portrait preview</option><option value="square">Square preview</option><option value="original">Original ratio</option></select><small>Preview only · your original image stays unchanged.</small></div>}<Preview platform={previewPlatform} text={previewText} media={draft.media?.dataUrl} frame={instagramFrame} /></section>
        </div>
      </div>}

      {page === 'drafts' && <section className="panel library-panel"><div className="panel-heading"><div><h2>Draft library</h2><p className="panel-subtitle">Private to this browser{user ? ' · backed up to Supabase' : ''}</p></div><button className="button button-primary" onClick={newDraft}><Plus size={15} /> New draft</button></div>{drafts.length ? <><div className="draft-library-tools"><label className="draft-search"><span className="sr-only">Search drafts</span><input type="search" placeholder="Search titles and post text" value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} /></label><label className="draft-filter"><span className="sr-only">Filter drafts by platform</span><select value={draftPlatformFilter} onChange={(event) => setDraftPlatformFilter(event.target.value as Platform | 'all')}><option value="all">All platforms</option>{platforms.map((platform) => <option key={platform} value={platform}>{labelFor[platform]}</option>)}</select></label></div>{filteredDrafts.length ? <div className="draft-grid">{filteredDrafts.map((item) => <DraftCard key={item.id} draft={item} open={() => openDraft(item)} duplicate={() => duplicateDraft(item)} remove={() => removeDraft(item.id)} />)}</div> : <div className="draft-no-results"><b>No matching drafts</b><span>Try another search or platform.</span></div>}</> : <Empty title="Nothing drafted yet" copy="Start with one short post, then adapt it for each destination." action={newDraft} />}</section>}

      {page === 'calendar' && <section className="panel library-panel"><div className="panel-heading"><div><h2>Planned posts</h2><p className="panel-subtitle">A quiet list of what you intend to publish.</p></div><button className="button button-primary" onClick={newDraft}><Plus size={15} /> Plan a post</button></div>{scheduled.length ? <div className="schedule-list">{scheduled.map((item) => <div className="schedule-row" key={item.id}><div className="schedule-date"><b>{new Date(item.scheduledAt!).toLocaleDateString(undefined, { day: '2-digit' })}</b><span>{new Date(item.scheduledAt!).toLocaleDateString(undefined, { month: 'short' })}</span></div><div className="schedule-copy"><b>{summaryFor(item)}</b><span>{item.platforms.map((platform) => labelFor[platform]).join(' · ')}</span></div><time>{new Date(item.scheduledAt!).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</time><button className="icon-button" aria-label="Edit scheduled post" onClick={() => openDraft(item)}><PenLine size={15} /></button></div>)}</div> : <Empty title="Your planner is clear" copy="Choose “Plan for later” in the editor to add a reminder here." action={newDraft} />}</section>}

      {page === 'settings' && <section className="panel settings-panel"><div className="settings-intro"><div className="settings-icon"><Settings2 size={19} /></div><div><h2>Privacy and backups</h2><p>Postroom does not collect your platform passwords or session cookies. Drafts stay in your browser unless you choose cloud backup.</p></div></div>
        <div className="integration-section"><div className="integration-head"><div><h3>Optional direct publishing</h3><p>Free handoff is always available. Connect an official API account if you want direct publishing and accept its setup or usage costs.</p></div><span className="integration-mode">{connections.length ? `${connections.length} CONNECTED` : 'OPTIONAL'}</span></div><div className="integration-cards">
          {(['x', 'instagram'] as Platform[]).map((platform) => { const connection = connections.find((item) => item.platform === platform); return <div className="integration-card" key={platform}><div className="integration-platform"><PlatformMark platform={platform} /><b>{labelFor[platform]}</b></div><p>{platform === 'x' ? 'OAuth connection. X API usage is billed to the developer project owner.' : 'Meta OAuth. Requires an eligible Instagram Professional account and app permissions.'}</p><div className="integration-bottom"><span className={connection ? 'connected-status' : 'pending-status'}>{connection ? `Connected${connection.username ? ` · @${connection.username}` : ''}` : supabase ? user ? 'Not connected' : 'Sign in required' : 'Backend setup required'}</span>{connection ? <button className="text-button danger" onClick={() => void disconnectPlatform(platform)}>Disconnect</button> : <button className="button button-light" onClick={() => void connectPlatform(platform)} disabled={!supabase || !user}>Connect</button>}</div></div>; })}
          <div className="integration-card substack-card"><div className="integration-platform"><PlatformMark platform="substack" /><b>Substack Notes</b></div><p>Keep using the free handoff. Substack’s published developer API doesn’t document Note publishing.</p><div className="integration-bottom"><span className="pending-status">Handoff only</span><button className="button button-light" onClick={() => void publishHandoff('substack')}>Open Notes</button></div></div>
        </div>{!supabase && <div className="integration-footnote">To enable account connections, configure Supabase and deploy the included Edge Functions. Provider app credentials stay in Supabase secrets, never in this website.</div>}</div>
        <div className="setting-row"><div><b>Local drafts</b><span>Stored in this browser with local storage. Export a backup before switching devices.</span></div><div className="setting-actions"><button className="button button-light" onClick={exportBackup}><ArrowDownToLine size={15} /> Export</button><label className="button button-light upload-button"><Upload size={15} /> Import<input type="file" accept="application/json,.json" onChange={(event) => importBackup(event.target.files?.[0])} /></label></div></div>
        <div className="setting-row"><div><b>Optional Supabase cloud backup</b><span>{supabase ? user ? `Signed in as ${user.email ?? 'your account'}. ${syncMessage}.` : 'Connect your own Supabase project to sync drafts across devices.' : 'Not configured. The app works fully in local-only mode.'}</span></div>{user ? <button className="button button-light" onClick={() => void signOut()}><LogOut size={15} /> Sign out</button> : null}</div>
        {!user && supabase && <form className="auth-form" onSubmit={(event) => void submitAuth(event)}><div className="auth-title">{authMode === 'in' ? 'Sign in to sync drafts' : 'Create a sync account'}</div><div className="auth-fields"><input type="email" required autoComplete="email" placeholder="Email address" value={email} onChange={(event) => setEmail(event.target.value)} /><input type="password" required minLength={6} autoComplete={authMode === 'in' ? 'current-password' : 'new-password'} placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} /><button className="button button-primary" disabled={authBusy}>{authBusy ? 'Working…' : authMode === 'in' ? 'Sign in' : 'Create account'}</button></div><button type="button" className="text-button" onClick={() => setAuthMode(authMode === 'in' ? 'up' : 'in')}>{authMode === 'in' ? 'Need an account? Create one' : 'Already have an account? Sign in'}</button></form>}
        {!supabase && <div className="setup-hint"><Cloud size={17} /><div><b>Cloud backup is optional</b><span>To enable it, create a Supabase project, copy <code>.env.example</code> to <code>.env</code>, fill in the project URL and anon key, then run the SQL migration included with this project.</span></div></div>}
        <div className="setting-row"><div><b>Delete local drafts</b><span>Remove every draft saved in this browser. A cloud backup is not deleted.</span></div><button className="button button-danger" onClick={() => { if (confirm('Delete all local drafts from this browser?')) { setDrafts([]); writeDrafts([]); setDraft(freshDraft()); setToast('Local drafts cleared'); } }}><Trash2 size={15} /> Clear local drafts</button></div>
        <div className="disclaimer"><b>Publishing status</b><span>Direct publishing is optional and requires provider app setup. X API create-post calls are usage-priced; Meta requires app authorization and an eligible Professional account for Instagram publishing. Substack’s official public API documentation does not describe a Notes publishing endpoint. The platform handoff is free.</span></div>
      </section>}
    </main>
    {publishReview && <div className="modal-backdrop" role="presentation" onClick={() => !isPublishing && setPublishReview(null)}><section className="publish-review" role="dialog" aria-modal="true" aria-labelledby="publish-review-title" onClick={(event) => event.stopPropagation()}><div className="panel-heading"><h2 id="publish-review-title">Review before publishing</h2><button className="icon-button" aria-label="Close review" onClick={() => !isPublishing && setPublishReview(null)} disabled={isPublishing}>×</button></div><div className="review-destination"><PlatformMark platform={publishReview} /><b>{labelFor[publishReview]}</b><span>{connections.find((item) => item.platform === publishReview)?.username ? `@${connections.find((item) => item.platform === publishReview)?.username}` : 'Connected account'}</span></div>{publishReview === 'instagram' && draft.media && <img className="review-image" src={draft.media.dataUrl} alt="Image to publish" />}<div className="review-caption">{draft.text[publishReview] || <span className="muted">No caption</span>}</div><p className="review-note">{publishReview === 'instagram' ? 'This will publish to the connected Instagram account. Check the image and caption before continuing.' : 'This uses the connected X API project. Usage charges are billed to the project owner.'}</p><div className="review-actions"><button className="button button-light" onClick={() => setPublishReview(null)} disabled={isPublishing}>Cancel</button><button className="button button-primary" onClick={() => void confirmPublish()} disabled={isPublishing}>{isPublishing ? 'Publishing…' : 'Publish now'}</button></div></section></div>}
    {toast && <div className="toast" role="status">{toast}</div>}
  </div>;
}

function SideButton({ icon, label, count, active, onClick }: { icon: ReactNode; label: string; count?: number; active: boolean; onClick: () => void }) {
  return <button className={`side-button ${active ? 'active' : ''}`} onClick={onClick}><span className="side-icon">{icon}</span><span className="nav-copy">{label}</span>{count !== undefined && <small>{count}</small>}</button>;
}

function PlatformMark({ platform }: { platform: Platform }) {
  if (platform === 'instagram') return <Instagram className="platform-mark insta-mark" size={15} />;
  if (platform === 'x') return <span className="x-mark">𝕏</span>;
  return <span className="substack-mark">S</span>;
}

function Preview({ platform, text, media, frame = 'original' }: { platform: Platform; text: string; media?: string; frame?: 'original' | 'square' | 'portrait' }) {
  const image = media && <img className={`social-media ${platform === 'instagram' ? `instagram-frame ${frame}` : ''}`} src={media} alt="Post preview" />;
  const caption = <div className={`social-copy ${!text ? 'placeholder' : ''}`}>{text || 'Your post will appear here as you write.'}</div>;
  return <div className={`social-preview ${platform}`}>
    <div className="social-account"><div className={`social-avatar ${platform}`}>{platform === 'substack' ? 'Y' : 'Y'}</div><div><b>Your account</b><span>{platform === 'x' ? '@yourhandle · now' : platform === 'substack' ? 'Your publication' : '@yourhandle'}</span></div><MoreHorizontal size={16} /></div>
    {platform === 'instagram' ? <>{image}<div className="instagram-caption"><b>yourhandle</b> {text || <span className="placeholder">Your caption will appear here…</span>}</div></> : <>{caption}{image}</>}
    <div className="social-actions"><span>{platform === 'instagram' ? '♡　◯　↗' : platform === 'x' ? '♡　↻　↗' : '♡　↗'}</span><small>{platform === 'instagram' ? 'Illustrative Instagram preview' : `${labelFor[platform]} preview`}</small></div>
  </div>;
}

function DraftCard({ draft, open, duplicate, remove }: { draft: PostDraft; open: () => void; duplicate: () => void; remove: () => void }) {
  return <article className="draft-card"><button className="draft-open" onClick={open}><div className="draft-card-top"><div className="draft-platforms">{draft.platforms.map((platform) => <PlatformMark key={platform} platform={platform} />)}</div><span>{draft.scheduledAt ? 'PLANNED' : 'DRAFT'}</span></div><h3>{draft.title || summaryFor(draft).split('\n')[0].slice(0, 58)}</h3><p>{summaryFor(draft)}</p><div className="draft-card-foot">Updated {new Date(draft.updatedAt).toLocaleDateString()} <ArrowUpRight size={14} /></div></button><button className="draft-duplicate" aria-label="Duplicate draft" title="Duplicate draft" onClick={duplicate}><Copy size={13} /></button><button className="draft-delete" aria-label="Delete draft" onClick={remove}><Trash2 size={14} /></button></article>;
}

function Empty({ title, copy, action }: { title: string; copy: string; action: () => void }) {
  return <div className="empty-state"><div className="empty-icon"><FileText size={19} /></div><h3>{title}</h3><p>{copy}</p><button className="button button-light" onClick={action}><ArrowLeft size={14} /> Go to compose</button></div>;
}
