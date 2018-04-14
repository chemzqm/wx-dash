#!/usr/bin/env bash

json -e 'var v = this.version; var n = parseInt(v.match(/\.(\d+)$/)[1]); n++ ; this.version = v.replace(/\.\d+$/, "." + n)' -f package.json -I
version=`cat package.json | json version`
echo $version

cat << EOF > wxdash.xml
<entry>
    <version>$version</version>
    <url>https://raw.githubusercontent.com/chemzqm/wx-dash/master/wxapp.tgz</url>
</entry>
EOF
git add .
tar --exclude='.DS_Store' -cvzf wxapp.tgz wxapp.docset
git commit -a -m "Release $version"
git tag -a "$version" -m "Release $version"
git push --tags
git push
