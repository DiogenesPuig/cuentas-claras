import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { PersonaBreakdown } from './PersonaBreakdown';
import type { PersonaSpending } from '../aggregate';

function makePerson(overrides: Partial<PersonaSpending> = {}): PersonaSpending {
  return {
    key: 'member-1',
    holder: 'Ana',
    expense: 600,
    share: 0.75,
    mainCategory: 'Super',
    mainLabel: 'Super',
    categories: [
      { label: 'Super', amount: 450, share: 0.75 },
      { label: 'Transporte', amount: 150, share: 0.25 },
    ],
    ...overrides,
  };
}

describe('PersonaBreakdown', () => {
  it('MEJ-11: no muestra el desglose por categoría hasta que se expande', () => {
    render(<PersonaBreakdown people={[makePerson()]} baseCurrency="ARS" />);
    expect(screen.queryByText('Transporte')).not.toBeInTheDocument();
  });

  it('MEJ-11: al expandir una persona se ve el monto de cada categoría', async () => {
    render(<PersonaBreakdown people={[makePerson()]} baseCurrency="ARS" />);
    await userEvent.click(screen.getByRole('button', { name: 'Ver categorías de Ana' }));
    expect(screen.getByText('Super')).toBeInTheDocument();
    expect(screen.getByText('Transporte')).toBeInTheDocument();
    expect(screen.getByText(/25%/)).toBeInTheDocument();
  });

  it('MEJ-11: se puede volver a colapsar', async () => {
    render(<PersonaBreakdown people={[makePerson()]} baseCurrency="ARS" />);
    await userEvent.click(screen.getByRole('button', { name: 'Ver categorías de Ana' }));
    await userEvent.click(screen.getByRole('button', { name: 'Ocultar categorías de Ana' }));
    expect(screen.queryByText('Transporte')).not.toBeInTheDocument();
  });

  it('no muestra el botón de expandir si la persona no tiene categorías', () => {
    render(<PersonaBreakdown people={[makePerson({ categories: [] })]} baseCurrency="ARS" />);
    expect(screen.queryByRole('button', { name: /categorías de Ana/ })).not.toBeInTheDocument();
  });
});
