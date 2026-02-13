import { Component, type ReactNode } from 'react';

interface Props {
  sectionName: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class SectionErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="ed-chart-container" style={{ opacity: 0.6 }}>
          <div className="text-center py-8">
            <p className="text-slate-400 text-lg" style={{ fontFamily: 'var(--font-display)' }}>
              {this.props.sectionName.toUpperCase()} UNAVAILABLE
            </p>
            <p className="text-slate-500 text-sm mt-2">
              This section could not be rendered.
              {this.state.error && (
                <span className="block mt-1 text-xs text-slate-600 font-mono">
                  {this.state.error.message}
                </span>
              )}
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
