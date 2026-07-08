import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

// A helper component that throws an error when rendered
const ProblemChild = () => {
  throw new Error('Test render explosion');
};

describe('ErrorBoundary component', () => {
  const originalConsoleError = console.error;

  beforeEach(() => {
    // Silence React error boundary logs during tests
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  it('renders children normally when there is no error', () => {
    render(
      <ErrorBoundary>
        <div data-testid="child">Safe Child Content</div>
      </ErrorBoundary>
    );

    expect(screen.getByTestId('child')).toHaveTextContent('Safe Child Content');
  });

  it('renders error recovery UI when a child component throws an error', () => {
    render(
      <ErrorBoundary>
        <ProblemChild />
      </ErrorBoundary>
    );

    expect(screen.getByText('⚠️ Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Reload Application')).toBeInTheDocument();
    expect(screen.getByText(/Test render explosion/)).toBeInTheDocument();
  });

  it('renders custom fallback UI if provided when an error occurs', () => {
    render(
      <ErrorBoundary fallback={<div data-testid="custom-fallback">Custom Error View</div>}>
        <ProblemChild />
      </ErrorBoundary>
    );

    expect(screen.getByTestId('custom-fallback')).toHaveTextContent('Custom Error View');
    expect(screen.queryByText('⚠️ Something went wrong')).not.toBeInTheDocument();
  });
});
