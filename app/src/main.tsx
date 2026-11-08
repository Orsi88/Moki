import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { pageParams } from './api';
import { installTheme } from './theme';
import { installModalLayers } from './modal-layer';
import { DialogHost } from './components/DialogHost';
import './styles.css';
import './dialogs.css';

installTheme();
installModalLayers();

// The view is chosen before importing any screen: the search and note windows must not load the main window's code
// (Home, Settings, Workspace), and the main window stays one App chunk. i18n and the theme are shared by all of them.
const view = pageParams().get('view');
const screen = view === 'search' ? import('./SearchWindow').then((m) => m.SearchWindow)
  : view === 'note' ? import('./NoteWindow').then((m) => m.NoteWindow)
  : import('./App').then((m) => m.App);

void screen.then((Screen) => {
  createRoot(document.getElementById('root') as HTMLElement).render(
    <StrictMode>
      <Screen />
      <DialogHost />
    </StrictMode>,
  );
});
