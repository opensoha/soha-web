import type { ErrorInfo, ReactNode } from 'react'
import { Component } from 'react'
import { Button, Result } from 'antd'

interface AppErrorBoundaryProps {
  children: ReactNode
}

interface AppErrorBoundaryState {
  error: Error | null
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    error: null,
  }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled React render error', error, info.componentStack)
  }

  handleReload = () => {
    window.location.reload()
  }

  handleGoHome = () => {
    window.location.assign('/')
  }

  render() {
    if (!this.state.error) {
      return this.props.children
    }

    return (
      <main className="soha-error-boundary" role="alert">
        <Result
          status="500"
          title="页面渲染失败"
          subTitle={this.state.error.message || '当前页面发生未处理错误。'}
          extra={[
            <Button key="reload" type="primary" onClick={this.handleReload}>
              重新加载
            </Button>,
            <Button key="home" onClick={this.handleGoHome}>
              返回首页
            </Button>,
          ]}
        />
      </main>
    )
  }
}
