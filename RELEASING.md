# Releasing

Tag a commit on `main` as `vX.Y.Z` and push the tag:

```sh
git tag v0.1.0 origin/main
git push origin v0.1.0
```

`release.yml` reruns the checks at that commit, stamps the tag's version into `package.json` (nothing is committed), builds, and publishes to npm with provenance through trusted publishing: no token.

npm configures a trusted publisher only for a package that exists, so the first version is published by hand once; the publisher is repository `jmbarzee/force-graph`, workflow `release.yml`.
