import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import {
  ArrowDownToLine, ArrowLeft, ArrowUpRight, CalendarDays, Check, ChevronDown,
  Cloud, Copy, FileText, ImagePlus, Instagram, LogOut, MoreHorizontal,
  PenLine, Plus, Settings2, Sparkles, Trash2, Upload,
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { readDrafts, writeDrafts } from './lib/storage';
import { freshDraft, platformNames } from './types';
import type { Page, Platform, PostDraft } from './types';

const platforms: Platform[] = ['instagram', 'x', 'substack'];
const labelFor: Record<Platform, string> = { instagram: 'Instagram', x: 'X', substack: 'Substack Notes' };
const summaryFor = (draft: PostDraft) => draft.text[draft.platforms[0] ?? 'instagram'] || 'Untitled draft';

export default function App() {
  const [page, setPage] = useState<Page>('compose');
  const [drafts, setDrafts] = useState<PostDraft[]>(readDrafts);
  const [draft, setDraft] = useState<PostDraft>(freshDraft);
  const [activePlatform, setActivePlatform] = useState<Platform>('instagram');
  const [previewPlatform, setPreviewPlatform] = useState<Platform>('instagram');
  const [toast, setToast] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'in' | 'up'>('in');
  const [syncMessage, setSyncMessage] = useState('Saved on this device');
  const [authBusy, setAuthBusy] = useState(false);

  const visibleText = draft.text[activePlatform];
  const previewText = draft.text[previewPlatform];
  const scheduled = useMemo(
    () => drafts.filter((item) => item.scheduledAt).sort((a, b) => (a.scheduledAt ?? '').localeCompare(b.scheduledAt ?? '')),
    [drafts],
  );

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
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

  function downloadMedia() {
    if (!draft.media) return;
    const link = document.createElement('a'); link.href = draft.media.dataUrl; link.download = draft.media.name || 'postroom-image'; link.click();
  }

  function handleImage(file?: File) {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setToast('Choose an image file'); return; }
    if (file.size > 1_500_000) { setToast('Choose an image under 1.5 MB for local storage'); return; }
    const reader = new FileReader();
    reader.onload = () => patchDraft({ media: { name: file.name, dataUrl: String(reader.result) } });
    reader.readAsDataURL(file);
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
      {platforms.map((platform) => <div className="side-platform" key={platform}><PlatformMark platform={platform} /><span>{labelFor[platform]}</span><span className="manual">MANUAL</span></div>)}
      <div className="sidebar-bottom"><div className="quiet-note">No feeds. No scrolling.<br />Just your next post.</div><button className="side-button" onClick={() => setPage('settings')}><Settings2 size={16} /> Settings</button></div>
    </aside>

    <main className="main-area">
      <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> <b>{pageMeta[page].crumb}</b></div><div className="privacy-chip"><span />{user ? 'CLOUD BACKUP ON' : 'PRIVATE · THIS DEVICE'}</div></header>
      <div className="page-heading"><div><div className="eyebrow">YOUR PUBLISHING DESK</div><h1>{pageMeta[page].title}</h1><p>{pageMeta[page].subtitle}</p></div>{page === 'compose' && <div className="save-indicator"><span className="save-dot" />{syncMessage}</div>}</div>

      {page === 'compose' && <div className="compose-grid">
        <section className="panel compose-panel">
          <div className="panel-heading"><h2>New post</h2><span className="tiny-label">01 — COMPOSE</span></div>
          <div className="field-label">Choose destinations</div>
          <div className="platform-pills">{platforms.map((platform) => <button key={platform} className={`platform-pill ${draft.platforms.includes(platform) ? 'selected' : ''}`} onClick={() => togglePlatform(platform)} aria-pressed={draft.platforms.includes(platform)}><span className="check-box">{draft.platforms.includes(platform) && <Check size={11} />}</span><PlatformMark platform={platform} />{labelFor[platform]}</button>)}</div>
          <div className="editor-tabs" role="tablist" aria-label="Platform versions">{draft.platforms.map((platform) => <button key={platform} role="tab" aria-selected={activePlatform === platform} className={activePlatform === platform ? 'active' : ''} onClick={() => setActivePlatform(platform)}>{labelFor[platform]}</button>)}</div>
          <div className="field-row"><label className="field-label" htmlFor="post-copy">Your {activePlatform === 'substack' ? 'Note' : 'post'}</label>{activePlatform === 'x' && <span className={`char-count ${visibleText.length > 280 ? 'over' : ''}`}>{visibleText.length} / 280</span>}</div>
          <div className="text-area-wrap"><textarea id="post-copy" value={visibleText} onChange={(event) => setPlatformText(activePlatform, event.target.value)} placeholder={activePlatform === 'substack' ? 'A thought worth sharing…' : 'What would you like to share?'} maxLength={activePlatform === 'x' ? 5000 : undefined} /></div>
          <div className="editor-tools"><label className="button button-light upload-button"><ImagePlus size={15} />{draft.media ? 'Replace image' : 'Add image'}<input type="file" accept="image/*" onChange={(event) => handleImage(event.target.files?.[0])} /></label><span className="helper-text">Images are kept with this draft on your device.</span><button className="icon-button" title="Copy this version" onClick={() => void copyText(visibleText)}><Copy size={15} /></button></div>
          {draft.media && <div className="media-preview"><img src={draft.media.dataUrl} alt="Selected post media" /><div className="media-caption"><span>{draft.media.name}</span><div><button className="text-button" onClick={downloadMedia}><ArrowDownToLine size={14} /> Download</button><button className="text-button danger" onClick={() => patchDraft({ media: undefined })}><Trash2 size={14} /> Remove</button></div></div></div>}
          <div className="editor-divider" />
          <details className="schedule-details"><summary><CalendarDays size={16} /><span>Plan for later</span><ChevronDown size={15} /></summary><div className="schedule-fields"><label>Publish date and time<input type="datetime-local" value={draft.scheduledAt ? draft.scheduledAt.slice(0, 16) : ''} onChange={(event) => patchDraft({ scheduledAt: event.target.value ? new Date(event.target.value).toISOString() : undefined })} /></label><p>This is a reminder in your planner only. The app can’t publish in the background without platform authorization.</p></div></details>
          <div className="editor-footer"><span className="autosave-note"><span className="save-dot" />Autosaves as you write</span><div className="footer-buttons"><button className="button button-light" onClick={() => setToast('Draft saved automatically')}>Save draft</button><button className="button button-primary" onClick={() => void publishHandoff(activePlatform)}>Continue to {activePlatform === 'substack' ? 'Notes' : platformNames[activePlatform]} <ArrowUpRight size={15} /></button></div></div>
        </section>

        <div className="right-rail">
          <section className="panel preview-panel"><div className="preview-heading"><h2>Preview</h2><div className="preview-switch">{draft.platforms.map((platform) => <button key={platform} className={previewPlatform === platform ? 'active' : ''} onClick={() => setPreviewPlatform(platform)}>{platform === 'instagram' ? 'IG' : platform === 'substack' ? 'Notes' : 'X'}</button>)}</div></div><Preview platform={previewPlatform} text={previewText} media={draft.media?.dataUrl} /></section>
          <section className="panel publish-panel"><div className="publish-icon"><Sparkles size={17} /></div><h3>One last step, on purpose.</h3><p>Postroom keeps the feed out of sight. Review and publish in the platform so you stay in control.</p><div className="handoff-list">{draft.platforms.map((platform) => <button key={platform} onClick={() => void publishHandoff(platform)}><span><PlatformMark platform={platform} />{labelFor[platform]}</span><ArrowUpRight size={15} /></button>)}</div><div className="safe-note">X opens with text prefilled. Instagram and Substack Notes open separately; your text is copied for pasting.</div></section>
        </div>
      </div>}

      {page === 'drafts' && <section className="panel library-panel"><div className="panel-heading"><div><h2>Draft library</h2><p className="panel-subtitle">Private to this browser{user ? ' · backed up to Supabase' : ''}</p></div><button className="button button-primary" onClick={newDraft}><Plus size={15} /> New draft</button></div>{drafts.length ? <div className="draft-grid">{drafts.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((item) => <DraftCard key={item.id} draft={item} open={() => openDraft(item)} remove={() => removeDraft(item.id)} />)}</div> : <Empty title="Nothing drafted yet" copy="Start with one short post, then adapt it for each destination." action={newDraft} />}</section>}

      {page === 'calendar' && <section className="panel library-panel"><div className="panel-heading"><div><h2>Planned posts</h2><p className="panel-subtitle">A quiet list of what you intend to publish.</p></div><button className="button button-primary" onClick={newDraft}><Plus size={15} /> Plan a post</button></div>{scheduled.length ? <div className="schedule-list">{scheduled.map((item) => <div className="schedule-row" key={item.id}><div className="schedule-date"><b>{new Date(item.scheduledAt!).toLocaleDateString(undefined, { day: '2-digit' })}</b><span>{new Date(item.scheduledAt!).toLocaleDateString(undefined, { month: 'short' })}</span></div><div className="schedule-copy"><b>{summaryFor(item)}</b><span>{item.platforms.map((platform) => labelFor[platform]).join(' · ')}</span></div><time>{new Date(item.scheduledAt!).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</time><button className="icon-button" aria-label="Edit scheduled post" onClick={() => openDraft(item)}><PenLine size={15} /></button></div>)}</div> : <Empty title="Your planner is clear" copy="Choose “Plan for later” in the editor to add a reminder here." action={newDraft} />}</section>}

      {page === 'settings' && <section className="panel settings-panel"><div className="settings-intro"><div className="settings-icon"><Settings2 size={19} /></div><div><h2>Privacy and backups</h2><p>Postroom does not collect your platform passwords or session cookies. Drafts stay in your browser unless you choose cloud backup.</p></div></div><div className="setting-row"><div><b>Local drafts</b><span>Stored in this browser with local storage. Export a backup before switching devices.</span></div><div className="setting-actions"><button className="button button-light" onClick={exportBackup}><ArrowDownToLine size={15} /> Export</button><label className="button button-light upload-button"><Upload size={15} /> Import<input type="file" accept="application/json,.json" onChange={(event) => importBackup(event.target.files?.[0])} /></label></div></div>
        <div className="setting-row"><div><b>Optional Supabase cloud backup</b><span>{supabase ? user ? `Signed in as ${user.email ?? 'your account'}. ${syncMessage}.` : 'Connect your own Supabase project to sync drafts across devices.' : 'Not configured. The app works fully in local-only mode.'}</span></div>{user ? <button className="button button-light" onClick={() => void signOut()}><LogOut size={15} /> Sign out</button> : null}</div>
        {!user && supabase && <form className="auth-form" onSubmit={(event) => void submitAuth(event)}><div className="auth-title">{authMode === 'in' ? 'Sign in to sync drafts' : 'Create a sync account'}</div><div className="auth-fields"><input type="email" required autoComplete="email" placeholder="Email address" value={email} onChange={(event) => setEmail(event.target.value)} /><input type="password" required minLength={6} autoComplete={authMode === 'in' ? 'current-password' : 'new-password'} placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} /><button className="button button-primary" disabled={authBusy}>{authBusy ? 'Working…' : authMode === 'in' ? 'Sign in' : 'Create account'}</button></div><button type="button" className="text-button" onClick={() => setAuthMode(authMode === 'in' ? 'up' : 'in')}>{authMode === 'in' ? 'Need an account? Create one' : 'Already have an account? Sign in'}</button></form>}
        {!supabase && <div className="setup-hint"><Cloud size={17} /><div><b>Cloud backup is optional</b><span>To enable it, create a Supabase project, copy <code>.env.example</code> to <code>.env</code>, fill in the project URL and anon key, then run the SQL migration included with this project.</span></div></div>}
        <div className="setting-row"><div><b>Delete local drafts</b><span>Remove every draft saved in this browser. A cloud backup is not deleted.</span></div><button className="button button-danger" onClick={() => { if (confirm('Delete all local drafts from this browser?')) { setDrafts([]); writeDrafts([]); setDraft(freshDraft()); setToast('Local drafts cleared'); } }}><Trash2 size={15} /> Clear local drafts</button></div>
        <div className="disclaimer"><b>Publishing status</b><span>Direct API publishing is intentionally off. X API create-post calls are usage-priced; Meta requires app authorization for Instagram publishing; Substack’s official public API documentation does not describe a Notes publishing endpoint. The platform handoff is free.</span></div>
      </section>}
    </main>
    {toast && <div className="toast" role="status">{toast}</div>}
  </div>;
}

function SideButton({ icon, label, count, active, onClick }: { icon: ReactNode; label: string; count?: number; active: boolean; onClick: () => void }) {
  return <button className={`side-button ${active ? 'active' : ''}`} onClick={onClick}><span className="side-icon">{icon}</span>{label}{count !== undefined && <small>{count}</small>}</button>;
}

function PlatformMark({ platform }: { platform: Platform }) {
  if (platform === 'instagram') return <Instagram className="platform-mark insta-mark" size={15} />;
  if (platform === 'x') return <span className="x-mark">𝕏</span>;
  return <span className="substack-mark">S</span>;
}

function Preview({ platform, text, media }: { platform: Platform; text: string; media?: string }) {
  return <div className={`social-preview ${platform}`}>
    <div className="social-account"><div className={`social-avatar ${platform}`}>{platform === 'substack' ? 'Y' : 'Y'}</div><div><b>Your account</b><span>{platform === 'x' ? '@yourhandle · now' : platform === 'substack' ? 'Your publication' : '@yourhandle'}</span></div><MoreHorizontal size={16} /></div>
    <div className={`social-copy ${!text ? 'placeholder' : ''}`}>{text || 'Your post will appear here as you write.'}</div>
    {media && <img className="social-media" src={media} alt="Post preview" />}
    <div className="social-actions"><span>{platform === 'instagram' ? '♡　◯　↗' : platform === 'x' ? '♡　↻　↗' : '♡　↗'}</span><small>{labelFor[platform]} preview</small></div>
  </div>;
}

function DraftCard({ draft, open, remove }: { draft: PostDraft; open: () => void; remove: () => void }) {
  return <article className="draft-card"><button className="draft-open" onClick={open}><div className="draft-card-top"><div className="draft-platforms">{draft.platforms.map((platform) => <PlatformMark key={platform} platform={platform} />)}</div><span>{draft.scheduledAt ? 'PLANNED' : 'DRAFT'}</span></div><h3>{draft.title || summaryFor(draft).split('\n')[0].slice(0, 58)}</h3><p>{summaryFor(draft)}</p><div className="draft-card-foot">Updated {new Date(draft.updatedAt).toLocaleDateString()} <ArrowUpRight size={14} /></div></button><button className="draft-delete" aria-label="Delete draft" onClick={remove}><Trash2 size={14} /></button></article>;
}

function Empty({ title, copy, action }: { title: string; copy: string; action: () => void }) {
  return <div className="empty-state"><div className="empty-icon"><FileText size={19} /></div><h3>{title}</h3><p>{copy}</p><button className="button button-light" onClick={action}><ArrowLeft size={14} /> Go to compose</button></div>;
}
