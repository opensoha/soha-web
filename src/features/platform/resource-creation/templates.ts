const templates: Record<string, string> = {
  Deployment: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: example-deployment
spec:
  replicas: 1
  selector:
    matchLabels:
      app: example
  template:
    metadata:
      labels:
        app: example
    spec:
      containers:
        - name: app
          image: nginx:latest
`,
  StatefulSet: `apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: example-statefulset
spec:
  serviceName: example
  replicas: 1
  selector:
    matchLabels:
      app: example
  template:
    metadata:
      labels:
        app: example
    spec:
      containers:
        - name: app
          image: nginx:latest
`,
  DaemonSet: `apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: example-daemonset
spec:
  selector:
    matchLabels:
      app: example
  template:
    metadata:
      labels:
        app: example
    spec:
      containers:
        - name: app
          image: nginx:latest
`,
  Job: `apiVersion: batch/v1
kind: Job
metadata:
  name: example-job
spec:
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: job
          image: busybox:latest
          command: ["sh", "-c", "echo hello"]
`,
  CronJob: `apiVersion: batch/v1
kind: CronJob
metadata:
  name: example-cronjob
spec:
  schedule: "0 * * * *"
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: Never
          containers:
            - name: job
              image: busybox:latest
              command: ["sh", "-c", "date"]
`,
  Service: `apiVersion: v1
kind: Service
metadata:
  name: example-service
spec:
  selector:
    app: example
  ports:
    - port: 80
      targetPort: 8080
`,
  Ingress: `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: example-ingress
spec:
  rules:
    - host: example.local
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: example-service
                port:
                  number: 80
`,
}

export function getResourceCreateTemplate(kind: string) {
  return (
    templates[kind] ||
    `apiVersion: v1
kind: ${kind}
metadata:
  name: example
`
  )
}
