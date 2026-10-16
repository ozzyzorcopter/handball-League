// Keeps a render error in one league from blanking the whole app.
export class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="panel" style={{ padding: "1.5rem", textAlign: "center" }}>
        <div style={{ color: "#f87171", marginBottom: ".5rem" }}>Something went wrong showing this page.</div>
        <div className="muted" style={{ fontSize: ".75rem", marginBottom: "1rem" }}>{String(this.state.err && this.state.err.message || this.state.err)}</div>
        <button className="btn btn-ghost" onClick={this.props.onBack}>← Back</button>
      </div>
    );
  }
}
