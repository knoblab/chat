import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageList } from './MessageList';
import type { Message } from '../../types';

// Mock useMatrix hook
vi.mock('../../matrix/MatrixProvider', () => ({
  useMatrix: () => ({
    client: {
      getUserId: () => '@alice:matrix.org',
    },
  }),
}));

// Mock react-virtuoso to avoid rendering issues with virtuoso in JSDOM
vi.mock('react-virtuoso', () => {
  return {
    Virtuoso: ({ data, itemContent }: any) => (
      <div data-testid="mock-virtuoso">
        {data.map((item: any, index: number) => (
          <div key={item.id || index} data-testid={`msg-container-${item.id}`}>
            {itemContent(index, item)}
          </div>
        ))}
      </div>
    ),
  };
});

describe('MessageList component XSS prevention', () => {
  const mockOnContextMenu = vi.fn();
  const mockVirtuosoRef = { current: null };

  it('sanitizes formatted HTML messages with malicious onload/onerror events', () => {
    const maliciousMsg: Message = {
      id: 'msg1',
      sender: '@bob:matrix.org',
      body: '<img src="x" onload="alert(1)">',
      timestamp: 1700000000000,
      isEncrypted: false,
      formattedBody: '<img src="https://upload.wikimedia.org/wikipedia/commons/7/78/Image.jpg" onload="alert(\'hi\')">',
    };

    render(
      <MessageList
        messages={[maliciousMsg]}
        room={null}
        isDirect={false}
        onContextMenu={mockOnContextMenu}
        virtuosoRef={mockVirtuosoRef}
      />
    );

    // Locate the rendered image inside the formatted body container
    const imgEl = screen.getByRole('img');
    expect(imgEl).toBeInTheDocument();
    
    // The src attribute should remain
    expect(imgEl).toHaveAttribute('src', 'https://upload.wikimedia.org/wikipedia/commons/7/78/Image.jpg');
    
    // The onload attribute must be removed
    expect(imgEl).not.toHaveAttribute('onload');
  });

  it('sanitizes formatted HTML messages with script tags', () => {
    const maliciousMsg: Message = {
      id: 'msg2',
      sender: '@bob:matrix.org',
      body: '<script>alert(1)</script>Hello',
      timestamp: 1700000000000,
      isEncrypted: false,
      formattedBody: '<script>alert(\'hi\')</script><div>Hello World</div>',
    };

    render(
      <MessageList
        messages={[maliciousMsg]}
        room={null}
        isDirect={false}
        onContextMenu={mockOnContextMenu}
        virtuosoRef={mockVirtuosoRef}
      />
    );

    // script tag should be stripped, only the div/text should be rendered
    expect(screen.getByText('Hello World')).toBeInTheDocument();
    expect(screen.queryByText("alert('hi')")).not.toBeInTheDocument();
  });
});
