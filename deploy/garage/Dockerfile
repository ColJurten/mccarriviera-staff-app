FROM dxflrs/garage:v2.1.0 AS garage
FROM alpine:3.22.2
COPY --from=garage /garage /garage
ENTRYPOINT ["/bin/sh", "/init.sh"]
