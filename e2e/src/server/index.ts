import createApp from './app';
import { API_PORT } from '../ports';

createApp().listen(API_PORT, () => {
  console.log(`api listening on http://localhost:${API_PORT}`);
});
