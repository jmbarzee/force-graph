# Releasing

From a clean checkout of `origin/main`:

```sh
make release          # the next minor; TYPE=patch, or VERSION=X.Y.Z
```

It tags `vX.Y.Z` and pushes the tag; `release.yml` reruns the checks at that commit and publishes it to npm with provenance. The version comes from the tag (`package.json` is never bumped), and npm trusted publishing needs no token.

npm configures a trusted publisher only for a package that exists, so `0.0.1` was published by hand first (`npm version 0.0.1 --no-git-tag-version && npm publish`); the first tag is higher. The trusted publisher is repository `jmbarzee/force-graph`, workflow `release.yml`.
