import { render, screen } from '@testing-library/react-native';

import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('muestra título y descripción accesibles', async () => {
    await render(<EmptyState title="Todavía no hay hábitos" description="Crea el primero para empezar." />);
    expect(screen.getByText('Todavía no hay hábitos')).toBeTruthy();
    expect(screen.getByText('Crea el primero para empezar.')).toBeTruthy();
    expect(screen.getByRole('summary')).toBeTruthy();
  });

  it('no renderiza descripción vacía', async () => {
    await render(<EmptyState title="Sin retos" />);
    expect(screen.queryByText('Crea el primero para empezar.')).toBeNull();
  });
});
