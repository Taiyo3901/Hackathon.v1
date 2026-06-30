import React from "react";
import { SplitPdfViewer } from "./components/SplitPdfViewer";

type ErrorBoundaryState = {
  hasError: boolean;
  message: string;
  stack?: string;
};

class ErrorBoundary extends React.Component<
  React.PropsWithChildren,
  ErrorBoundaryState
> {
  constructor(props: React.PropsWithChildren) {
    super(props);

    this.state = {
      hasError: false,
      message: "",
      stack: "",
    };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : "",
    };
  }

  componentDidCatch(error: unknown) {
    console.error("[App] crashed:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-screen">
          <h1>アプリでエラーが発生しました</h1>
          <pre>
            {this.state.message}
            {"\n\n"}
            {this.state.stack}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <SplitPdfViewer />
    </ErrorBoundary>
  );
}