import { Component } from 'react';
import { RouteMessage } from './RouteMessage';

export class RouteErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) { console.error('Page failed to render:', error); }
  componentDidUpdate(previousProps) {
    if (this.state.failed && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ failed: false });
    }
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return <>
      <RouteMessage title="We could not load this page" message="Please reload and try again. Your saved changes are still available." />
      <div className="text-center"><button type="button" className="rounded-lg border px-4 py-2" onClick={() => window.location.reload()}>Reload page</button></div>
    </>;
  }
}
