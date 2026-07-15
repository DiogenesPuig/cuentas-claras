import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DateField } from './DateField';

describe('DateField', () => {
  it('el input sigue siendo tipeable a mano', async () => {
    const onChange = vi.fn();
    render(<DateField id="tx-date" label="Fecha" value="" onChange={onChange} />);
    await userEvent.type(screen.getByLabelText('Fecha'), '05/03/2026');
    expect(onChange).toHaveBeenCalled();
  });

  it('abre el calendario y elegir un día llama a onChange en DD/MM/AAAA', async () => {
    const onChange = vi.fn();
    render(<DateField id="tx-date" label="Fecha" value="15/07/2026" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Elegir fecha en el calendario' }));
    // El 15 ya está seleccionado (mes precargado en julio 2026); elegimos otro día del mismo mes.
    await userEvent.click(within(screen.getByRole('gridcell', { name: '20' })).getByRole('button'));
    expect(onChange).toHaveBeenCalledWith('20/07/2026');
  });

  it('cierra el calendario al elegir un día', async () => {
    const onChange = vi.fn();
    render(<DateField id="tx-date" label="Fecha" value="15/07/2026" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Elegir fecha en el calendario' }));
    await userEvent.click(within(screen.getByRole('gridcell', { name: '20' })).getByRole('button'));
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
  });

  it('cierra el calendario con Escape', async () => {
    const onChange = vi.fn();
    render(<DateField id="tx-date" label="Fecha" value="15/07/2026" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Elegir fecha en el calendario' }));
    expect(screen.getByRole('grid')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
  });

  it('muestra "(opcional)" en el label cuando corresponde', () => {
    render(<DateField id="tx-charged" label="Se cobra" optionalHint value="" onChange={vi.fn()} />);
    expect(screen.getByText('Se cobra (opcional)')).toBeInTheDocument();
  });
});
