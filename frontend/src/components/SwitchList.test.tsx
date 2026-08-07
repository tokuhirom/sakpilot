import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SwitchList } from './SwitchList';
import { sakura } from '../../wailsjs/go/models';
import { GetSwitches, DeleteSwitch } from '../../wailsjs/go/main/App';

vi.mock('../../wailsjs/go/main/App');

const zones: sakura.ZoneInfo[] = [
  new sakura.ZoneInfo({ id: 'is1a', name: '石狩第1ゾーン' }),
];

function makeSwitch(overrides: Partial<sakura.SwitchInfo> = {}): sakura.SwitchInfo {
  return new sakura.SwitchInfo({
    id: '123456789012',
    name: 'my-switch',
    description: '',
    serverCount: 0,
    networkMaskLen: 24,
    defaultRoute: '192.168.0.1',
    scope: 'user',
    subnets: [],
    ...overrides,
  });
}

describe('SwitchList', () => {
  beforeEach(() => {
    vi.mocked(GetSwitches).mockReset();
    vi.mocked(DeleteSwitch).mockReset();
  });

  it('lists switches returned by GetSwitches', async () => {
    vi.mocked(GetSwitches).mockResolvedValueOnce([makeSwitch()]);

    render(<SwitchList profile="default" zone="is1a" zones={zones} onZoneChange={() => {}} onSelectSwitch={() => {}} />);

    expect(await screen.findByText('my-switch')).toBeInTheDocument();
    expect(GetSwitches).toHaveBeenCalledWith('default', 'is1a');
  });

  it('shows an empty state when there are no switches', async () => {
    vi.mocked(GetSwitches).mockResolvedValueOnce([]);

    render(<SwitchList profile="default" zone="is1a" zones={zones} onZoneChange={() => {}} onSelectSwitch={() => {}} />);

    expect(await screen.findByText('スイッチがありません')).toBeInTheDocument();
  });

  it('navigates to switch detail when a row is clicked', async () => {
    vi.mocked(GetSwitches).mockResolvedValueOnce([makeSwitch()]);
    const onSelectSwitch = vi.fn();
    const user = userEvent.setup();

    render(<SwitchList profile="default" zone="is1a" zones={zones} onZoneChange={() => {}} onSelectSwitch={onSelectSwitch} />);
    await screen.findByText('my-switch');

    await user.click(screen.getByText('my-switch'));

    expect(onSelectSwitch).toHaveBeenCalledWith('123456789012');
  });

  it('disables 削除 for a shared switch', async () => {
    vi.mocked(GetSwitches).mockResolvedValueOnce([makeSwitch({ scope: 'shared' })]);

    render(<SwitchList profile="default" zone="is1a" zones={zones} onZoneChange={() => {}} onSelectSwitch={() => {}} />);
    await screen.findByText('my-switch');

    expect(screen.getByRole('button', { name: '削除' })).toBeDisabled();
  });

  it('deletes a switch after confirmation without triggering row navigation', async () => {
    vi.mocked(GetSwitches)
      .mockResolvedValueOnce([makeSwitch()])
      .mockResolvedValueOnce([]);
    vi.mocked(DeleteSwitch).mockResolvedValueOnce(undefined);
    const onSelectSwitch = vi.fn();
    const user = userEvent.setup();

    render(<SwitchList profile="default" zone="is1a" zones={zones} onZoneChange={() => {}} onSelectSwitch={onSelectSwitch} />);
    await screen.findByText('my-switch');

    await user.click(screen.getByRole('button', { name: '削除' }));

    expect(onSelectSwitch).not.toHaveBeenCalled();
    expect(await screen.findByText('スイッチ「my-switch」を削除しますか？')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '削除する' }));

    await waitFor(() => {
      expect(DeleteSwitch).toHaveBeenCalledWith('default', 'is1a', '123456789012');
    });
    await waitFor(() => {
      expect(GetSwitches).toHaveBeenCalledTimes(2);
    });
  });
});
