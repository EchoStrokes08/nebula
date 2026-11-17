import { Redirect } from 'expo-router';
import { Bell, Pencil, Star, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BarChart } from '@/components/charts/BarChart';
import { LineChart } from '@/components/charts/LineChart';
import { StatTile } from '@/components/charts/StatTile';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { PermissionState } from '@/components/feedback/PermissionState';
import { SkeletonList } from '@/components/feedback/Skeleton';
import { Chip } from '@/components/forms/Chip';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { Select } from '@/components/forms/Select';
import { Stepper } from '@/components/forms/Stepper';
import { Switch } from '@/components/forms/Switch';
import { TextArea } from '@/components/forms/TextArea';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { ConfirmDialog } from '@/components/overlays/ConfirmDialog';
import { ContextMenu } from '@/components/overlays/ContextMenu';
import { Button } from '@/components/primitives/Button';
import { Card } from '@/components/primitives/Card';
import { Divider } from '@/components/primitives/Divider';
import { GlassPanel } from '@/components/primitives/GlassPanel';
import { Icon } from '@/components/primitives/Icon';
import { Text } from '@/components/primitives/Text';
import { ContributionBar, ProgressBar } from '@/components/progress/ProgressBar';
import { ProgressRing } from '@/components/progress/ProgressRing';
import { colorFor } from '@/components/social/Avatar';
import { AvatarStack } from '@/components/social/AvatarStack';
import { LeaderboardRow } from '@/components/social/LeaderboardRow';
import { ParticipantChip } from '@/components/social/ParticipantChip';
import { colors, spacing, typography, type TypographyVariant } from '@/design/tokens';

const people = [
  { name: 'Lucía', seed: 'lucia' },
  { name: 'Marcos', seed: 'marcos' },
  { name: 'Ana', seed: 'ana' },
  { name: 'Diego', seed: 'diego' },
  { name: 'Sara', seed: 'sara' },
];

/** Catálogo de componentes (F02-015). Solo existe en desarrollo; en producción redirige. */
export default function Catalogo() {
  const [view, setView] = useState<'dia' | 'semana' | 'mes'>('dia');
  const [on, setOn] = useState(true);
  const [count, setCount] = useState(3);
  const [kind, setKind] = useState<'binary' | 'duration' | null>('duration');
  const [chip, setChip] = useState(true);
  const [confirm, setConfirm] = useState(false);
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <Screen title="Catálogo" overline="Sistema de diseño">
      <Section title="Tipografía">
        {(Object.keys(typography) as TypographyVariant[]).map((v) => <Text key={v} variant={v}>{v} · Constancia 82 %</Text>)}
        <Text tone="secondary">Secundario</Text><Text tone="tertiary">Terciario</Text>
        <View style={styles.row}><Text tone="success">Éxito</Text><Text tone="warning">Aviso</Text><Text tone="danger">Error</Text><Text tone="info">Info</Text></View>
      </Section>
      <Section title="Botones">
        <View style={styles.row}>
          <Button label="Primario" />
          <Button label="Secundario" variant="secondary" />
          <Button label="Fantasma" variant="ghost" />
          <Button label="Eliminar" variant="danger" icon={<Trash2 size={18} color={colors.danger} />} />
          <Button label="Cargando" loading />
          <Button label="Deshabilitado" disabled />
        </View>
      </Section>
      <Section title="Superficies">
        <View style={styles.row}>
          <Card style={styles.flex}><Text>Card</Text></Card>
          <Card tone="raised" style={styles.flex}><Text>Elevada</Text></Card>
          <Card tone="accent" style={styles.flex}><Text>Acento</Text></Card>
          <Card tone="warning" style={styles.flex}><Text>Aviso</Text></Card>
        </View>
        <GlassPanel><Text>GlassPanel — solo flotantes</Text></GlassPanel>
        <Divider />
        <View style={styles.row}><Icon as={Star} tone="accent" label="Favorito" /><Icon as={Bell} /><Icon as={Pencil} tone="tertiary" /></View>
      </Section>
      <Section title="Formularios">
        <TextField label="Nombre del hábito" placeholder="Leer 20 minutos" />
        <TextField label="Con error" value="x" error="Debe tener al menos 2 caracteres." />
        <TextArea label="Notas" placeholder="Qué funcionó hoy…" />
        <Select label="Tipo" value={kind} onChange={setKind} options={[{ value: 'binary', label: 'Sí / no' }, { value: 'duration', label: 'Duración', description: 'Minutos por periodo' }]} />
        <SegmentedControl label="Vista" value={view} onChange={setView} segments={[{ value: 'dia', label: 'Día' }, { value: 'semana', label: 'Semana' }, { value: 'mes', label: 'Mes' }]} />
        <Switch label="Recordatorios" description="Aviso a la hora sugerida" value={on} onChange={setOn} />
        <Switch label="Deshabilitado" value={false} onChange={() => {}} disabled />
        <Stepper label="Vasos de agua" value={count} onChange={setCount} min={0} max={12} unit="vasos" />
        <View style={styles.row}><Chip label="Salud" selected={chip} onToggle={() => setChip(!chip)} /><Chip label="Estudio" selected={false} onToggle={() => {}} /></View>
      </Section>
      <Section title="Progreso y gráficos">
        <ProgressBar progress={0.62} />
        <ContributionBar total={300} parts={people.slice(0, 3).map((p, i) => ({ value: [120, 80, 45][i]!, color: colorFor(p.seed), label: p.name }))} />
        <View style={styles.row}><ProgressRing progress={0.75} size={72} label="75 %"><Text variant="bodyStrong">75 %</Text></ProgressRing><StatTile label="Enfoque" value="6 h 20 min" delta={12} deltaLabel="vs. semana pasada" /></View>
        <BarChart summary="Minutos de enfoque por día" bars={['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((l, i) => ({ label: l, value: [40, 65, 20, 90, 55, 0, 30][i]! }))} />
        <LineChart summary="Cumplimiento semanal" labels={['S1', 'S2', 'S3', 'S4']} values={[52, 61, null, 78]} max={100} />
      </Section>
      <Section title="Social">
        <AvatarStack people={people} />
        <LeaderboardRow rank={1} name="Lucía" handle="lucia" score="92 %" progress={0.92} detail="276 de 300 min" />
        <LeaderboardRow rank={2} name="Tú" handle="yo" score="81 %" progress={0.81} detail="a 11 % del anterior" isMe />
        <View style={styles.row}><ParticipantChip name="Marcos" handle="marcos" status="accepted" /><ParticipantChip name="Ana" handle="ana" status="invited" onRemove={() => {}} /></View>
      </Section>
      <Section title="Estados">
        <EmptyState title="Aún no hay hábitos" description="Empieza con uno pequeño: lo importante es la constancia." action={<Button label="Crear hábito" />} />
        <SkeletonList rows={2} />
        <ErrorState onRetry={() => {}} />
        <ErrorState offline />
        <PermissionState title="Activa las notificaciones" reason="Solo para recordarte lo que tú programes." onRequest={() => {}} onSkip={() => {}} />
      </Section>
      <Section title="Superposiciones">
        <ContextMenu title="Leer 20 minutos" actions={[{ label: 'Editar', icon: Pencil, onSelect: () => {} }, { label: 'Eliminar', icon: Trash2, destructive: true, onSelect: () => {} }]}>
          <Card compact><Text>Clic derecho / pulsación larga aquí</Text></Card>
        </ContextMenu>
        <Button label="Abrir confirmación" variant="secondary" onPress={() => setConfirm(true)} />
        <ConfirmDialog visible={confirm} title="Eliminar hábito" message="Se borrarán también sus registros." confirmLabel="Eliminar" onConfirm={() => setConfirm(false)} onCancel={() => setConfirm(false)} />
      </Section>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="overline" tone="accent">{title.toUpperCase()}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing[3] },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3], alignItems: 'center' },
  flex: { flex: 1, minWidth: 140 },
});
