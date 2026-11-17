import { useLocalSearchParams } from 'expo-router';

import { GoalEditor } from '@/features/goals/GoalEditor';

export default function NuevaMeta() {
  const { tipo } = useLocalSearchParams<{ tipo?: string }>();
  return <GoalEditor presetKind={tipo === 'proyecto' ? 'project' : 'goal'} />;
}
