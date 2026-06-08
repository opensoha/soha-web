# Soha Web

This repository owns the Soha web console source.

The `soha` core repository consumes the built `dist` artifact only. Release builds copy this artifact into `soha/internal/staticassets/web/dist` before building the embedded Go binary.

## Development

```sh
npm install
npm run dev
```

## Build

```sh
npm run build
```

## License

This repository is licensed under the Apache License 2.0. See
[LICENSE](./LICENSE) for the full license text.
