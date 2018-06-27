# trembita-js

[![Build Status](https://travis-ci.com/wearereasonablepeople/trembita.svg?token=H11zxJynPszpg8G3VJzP&branch=master)](https://travis-ci.com/wearereasonablepeople/trembita)
[![codecov](https://codecov.io/gh/wearereasonablepeople/trembita/branch/master/graph/badge.svg?token=XWv9pmS1Vm)](https://codecov.io/gh/wearereasonablepeople/trembita)

> Request wrapper core for consuming third party services

Whenever you need to communicate with third party API to get or save data from own codebase, you would have to perform a set of common steps such as login, query, etc.
Trembita.js is doing the same by abstracting the innards of the actual REST calls to third-party API and exposing only the developer relevant details.
Trembita.js supports plugins which are API connectors that are exposing methods for API communication. Each plugin is describing another third-party service. It performs these commonly used functions - creates requests, parses responses, handles errors etc.

The goal of this module is not only to provide you with a simple interface but the implementation of commonly used tools out of the box. This is a core module to reuse with plugins each for a different third-party service.

## Table of Contents

- [Install](#install)
- [Usage](#usage)
- [Contribute](#contribute)
- [License](#license)

## Install

Using npm:

```
npm install trembita
```

Using yarn:
```
yarn add trembita
```

## Usage
Trembita is not supposed to be used directly, rather than to develop plugins.

## Contribute

See [the contribute file](CONTRIBUTING.md)!

## License

MIT © 2018 Wearereasonablepeople.com
