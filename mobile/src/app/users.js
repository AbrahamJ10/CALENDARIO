import { router } from 'expo-router';
import { Welcome } from '../components/Welcome';

// Selector de usuario que se abre desde Ajustes
export default function Users() {
  return <Welcome onClose={() => router.back()} />;
}
