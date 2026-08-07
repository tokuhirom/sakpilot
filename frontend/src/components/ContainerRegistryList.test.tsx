import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ContainerRegistryList } from './ContainerRegistryList';
import { sakura } from '../../wailsjs/go/models';
import { GetContainerRegistries, DeleteContainerRegistry } from '../../wailsjs/go/main/App';

vi.mock('../../wailsjs/go/main/App');

function makeRegistry(overrides: Partial<sakura.ContainerRegistryInfo> = {}): sakura.ContainerRegistryInfo {
  return new sakura.ContainerRegistryInfo({
    id: '123456789012',
    name: 'my-registry',
    description: '',
    fqdn: 'my-registry.sakuracr.jp',
    accessLevel: 'readwrite',
    virtualDomain: '',
    ...overrides,
  });
}

describe('ContainerRegistryList', () => {
  beforeEach(() => {
    vi.mocked(GetContainerRegistries).mockReset();
    vi.mocked(DeleteContainerRegistry).mockReset();
  });

  it('lists registries returned by GetContainerRegistries', async () => {
    vi.mocked(GetContainerRegistries).mockResolvedValueOnce([makeRegistry()]);

    render(<ContainerRegistryList profile="default" onSelectRegistry={() => {}} />);

    expect(await screen.findByText('my-registry')).toBeInTheDocument();
    expect(GetContainerRegistries).toHaveBeenCalledWith('default');
  });

  it('shows an empty state when there are no registries', async () => {
    vi.mocked(GetContainerRegistries).mockResolvedValueOnce([]);

    render(<ContainerRegistryList profile="default" onSelectRegistry={() => {}} />);

    expect(await screen.findByText('コンテナレジストリがありません')).toBeInTheDocument();
  });

  it('navigates to detail when a row is clicked', async () => {
    vi.mocked(GetContainerRegistries).mockResolvedValueOnce([makeRegistry()]);
    const onSelectRegistry = vi.fn();
    const user = userEvent.setup();

    render(<ContainerRegistryList profile="default" onSelectRegistry={onSelectRegistry} />);
    await screen.findByText('my-registry');

    await user.click(screen.getByText('my-registry'));

    expect(onSelectRegistry).toHaveBeenCalledWith(expect.objectContaining({ id: '123456789012' }));
  });

  it('deletes a registry after confirmation without triggering row navigation', async () => {
    vi.mocked(GetContainerRegistries)
      .mockResolvedValueOnce([makeRegistry()])
      .mockResolvedValueOnce([]);
    vi.mocked(DeleteContainerRegistry).mockResolvedValueOnce(undefined);
    const onSelectRegistry = vi.fn();
    const user = userEvent.setup();

    render(<ContainerRegistryList profile="default" onSelectRegistry={onSelectRegistry} />);
    await screen.findByText('my-registry');

    await user.click(screen.getByRole('button', { name: '削除' }));

    expect(onSelectRegistry).not.toHaveBeenCalled();
    expect(await screen.findByText('コンテナレジストリ「my-registry」を削除しますか？')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '削除する' }));

    await waitFor(() => {
      expect(DeleteContainerRegistry).toHaveBeenCalledWith('default', '123456789012');
    });
    await waitFor(() => {
      expect(GetContainerRegistries).toHaveBeenCalledTimes(2);
    });
  });
});
