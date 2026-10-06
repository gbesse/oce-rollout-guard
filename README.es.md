# OCE Rollout Guard

[Français](README.md) · [English](README.en.md)

Un protector externo de despliegue para OpenClaw Enterprise (OCE). Crea un plan a partir de un agente y su configuración, bloquea el despliegue si cambian, escribe una intención privada **antes** de llamar a deploy y después comprueba la revisión exacta y una prueba independiente. No elimina ni restaura revisiones automáticamente.

## Uso

Conecte primero la CLI occ a una instalación de ensayo. Copie config.example.json a un archivo privado en .local/ y sustituya los identificadores. probeCommand puede llamar a [oce-agent-conformance](https://github.com/gbesse/oce-agent-conformance) configurado con una prueba real del modelo. Nunca pase secretos como argumentos de comando.

    node src/cli.js plan .local/config.private.json .local/plan.json
    node src/cli.js dispatch .local/plan.json .local/dispatch.json --apply
    node src/cli.js verify .local/dispatch.json .local/report.json
    npm test

dispatch crea .local/dispatch.json.intent antes de llamar a OCC. Si se pierde la respuesta del despliegue, el resultado es unknown: examine las revisiones y la auditoría de OCE antes de otra solicitud. verify informa pass solo si el despliegue exacto tuvo éxito, esa revisión está activa, no hay advertencias y probeCommand devuelve un JSON con status igual a pass. Sin prueba, el resultado sigue siendo incomplete. El operador debe juzgar la procedencia de la prueba.

La [API de OCE](https://docs-enterprise.openclaw.org/guides/topics/agent-revisions/) no dispone de una operación pública de rollback. En caso de fallo, corrija la configuración conservada en control de versiones y despliegue una nueva revisión después de revisarla. Las pruebas del repositorio usan una CLI simulada; no se ha verificado ninguna instalación real.

Códigos de salida: 0 correcto o plan guardado, 1 fallo o resultado incierto, 2 pruebas incompletas. Licencia MIT.
