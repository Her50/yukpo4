import os, zipfile

for app in ['bourse', 'pharmacie', 'restaurant']:
    src = rf'c:\Users\23767\yukpomnang2\frontend\dist-{app}'
    zp  = rf'c:\Users\23767\yukpomnang2\frontend\deploy-{app}.zip'
    with zipfile.ZipFile(zp, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        for root, dirs, files in os.walk(src):
            for f in files:
                full = os.path.join(root, f)
                rel = os.path.relpath(full, src).replace(os.sep, '/')
                zi = zipfile.ZipInfo(rel)
                zi.compress_type = zipfile.ZIP_DEFLATED
                zi.external_attr = 0o644 << 16
                with open(full, 'rb') as fh:
                    z.writestr(zi, fh.read())
    print(f'{app}: {os.path.getsize(zp):,} bytes')
