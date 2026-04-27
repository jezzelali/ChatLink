/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FirebaseProvider } from './components/FirebaseProvider';
import SettingsPage from './components/SettingsPage';

export default function App() {
  return (
    <FirebaseProvider>
      <SettingsPage />
    </FirebaseProvider>
  );
}
