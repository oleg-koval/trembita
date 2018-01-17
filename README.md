# trembita-js

[![Build Status](https://travis-ci.com/wearereasonablepeople/trembita.svg?token=H11zxJynPszpg8G3VJzP&branch=master)](https://travis-ci.com/wearereasonablepeople/trembita)
[![codecov](https://codecov.io/gh/wearereasonablepeople/trembita/branch/master/graph/badge.svg?token=XWv9pmS1Vm)](https://codecov.io/gh/wearereasonablepeople/trembita)

> Request wrapper core for consuming third party services

Every time you are working on a project, you might find yourself rewriting requests to use third-party services, hopefully, covered with tests and proper error handling. However, you can forget to add some steps, like missed tests for corner cases, proper logs, "Fail Early, Fail Loudly".
The aim of this module is not only to provide you with a simple interface but the implementation of commonly used tools out of the box. This is a core module to reuse with plugins each for a different third-party service.

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
Below you can find the suggested implementation of such plugin.

## Contribute

See [the contribute file](CONTRIBUTING.md)!

## License

MIT © 2018 Wearereasonablepeople.com
