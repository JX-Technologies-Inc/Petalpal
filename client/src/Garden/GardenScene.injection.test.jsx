import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import GardenScene from './GardenScene';

vi.mock('../api', () => ({ apiRequest: vi.fn() }));

it('keeps journal, AI and social HTML/URL payloads literal in the active Flower DOM', async () => {
  const journal = '<img src=x onerror="window.__injected=1"><script>window.__injected=2</script>';
  const meaning = '<svg onload="window.__injected=3">AI & "meaning"</svg>';
  const message = '<a href="javascript:window.__injected=4">click</a> data:text/html,<script>x</script>';
  const author = '<iframe srcdoc="<script>x</script>"></iframe>';
  const name = 'Injected Flower';
  const { container } = render(<GardenScene
    owner={{ id: 'owner', name: 'Owner' }} currentUser={{ id: 'owner' }} isOwnGarden
    flowers={[{ id: 'flower', name, event: journal, meaning, mood: 'Calm',
      img: 'javascript:window.__injected=5', supportCount: 0,
      messages: [{ id: 'message', author, text: message }] }]}
  />);
  await userEvent.click(screen.getByAltText(name));
  for (const payload of [journal, meaning, message, author]) {
    expect(container.textContent).toContain(payload);
  }
  expect(container.querySelector('script, iframe, svg, a')).toBeNull();
  expect(container.querySelector('[onerror], [onload]')).toBeNull();
  expect(window.__injected).toBeUndefined();
  for (const image of container.querySelectorAll('img')) {
    expect(image.getAttribute('src')).toMatch(/^\/assets\/(pink|blue|purple|sunflower|tulip)\.png$/);
  }
});
