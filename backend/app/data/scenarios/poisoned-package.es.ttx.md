---
format: "ttx-zone.scenario"
format_version: 8
language: "es"
title: "Del paquete envenenado a los datos de producción"
exported_at: "2026-11-05T00:00:00+00:00"
generator: "ttx-zone"
attack_version: "19.2"
---

# Del paquete envenenado a los datos de producción

Un paquete malicioso de código abierto en el puesto de un desarrollador lleva, con claves cloud robadas y un asistente interno de IA, a la salida de datos de clientes de una entidad financiera. En cada paso los Jugadores votan una decisión, con los plazos de DORA y RGPD en marcha.

> Escenario de TTX-Zone. Impórtalo desde Biblioteca → Escenarios. La parte legible se genera al exportar; solo se importa el bloque de datos del final.

## Objetivos

- **OBJ-01** Contener sin parar el negocio
- **OBJ-02** Cumplir los hitos de notificación de DORA
- **OBJ-03** Incorporar el asistente de IA a la respuesta
- **OBJ-04** Rotar secretos en un orden seguro
- **OBJ-05** Notificar y contar una única versión

## Escenario

{organization} es una entidad financiera cuyos equipos de desarrollo, asistente interno de IA y bases de datos de producción funcionan sobre {cloud_platform}. Lo que empieza como una alerta en un puesto se convierte, en seis días, en un incidente grave notificable y una brecha de datos personales.

## Fases e injects

### PH-01 El paquete

Día 1, 09:00. Una mañana normal para los equipos de desarrollo de {organization}.

- **INJ-01** (T+5′) Una dependencia que lee demasiado
- **POL-02** (T+18′) Hasta dónde contener
  - El paquete está en un lockfile compartido y no sabes quién lo ejecutó. ¿Hasta dónde contienes?
    - Aislar el puesto, bloquear a todo el equipo de desarrollo y obligar a todos a identificarse de nuevo
      - Se cierran todas las vías visibles, también las de quienes instalaron la misma versión. El equipo se detiene y lo lleva mal, pero nada trasciende fuera.
    - Aislar solo ese puesto y rotar las credenciales que contenía
      - Proporcionado y rápido, y el desarrollo sigue. Quien instalara el paquete queda expuesto hasta que alguien lo encuentre.
    - Bloquear el paquete en toda la organización y parar las compilaciones hasta limpiar el lockfile
      - La propagación se frena en origen y se corrige el lockfile. Se retrasan las entregas de todos los equipos, y lo robado ya no vuelve.
    - Dejar el puesto conectado y vigilado para ver qué hace el actor
      - Averiguas adónde va el actor, pero dejas a un ladrón activo en la red y tendrás que explicar esa decisión al supervisor.

### PH-02 Las claves robadas

Día 1, unas horas después. La investigación pasa del puesto de trabajo a {cloud_platform}.

- **INJ-03** (T+35′) Claves robadas en uso en {cloud_platform}
- **INJ-04** (contingente) El CSIRT nacional pregunta
- **POL-05** (T+48′) El primer movimiento en la nube
  - Las claves robadas están activas y el actor explora. ¿Cuál es tu primer movimiento en {cloud_platform}?
    - Desactivar las claves robadas y obligar a toda la organización a cambiar sus credenciales
      - El actor pierde esas claves de inmediato. Lo nota toda la empresa, el soporte se desborda y empiezan las preguntas.
    - Bloquear las direcciones de la VPN con una regla de denegación
      - Rápido y barato, y da sensación de actuar. Una VPN comercial tiene muchas otras salidas, y el actor vuelve en menos de una hora.
    - Contratar a una firma forense externa para mapear a qué llegan las identidades y buscar persistencia
      - Conocerás el alcance y cualquier rastro de persistencia. Lleva días y dinero, y las claves siguen activas mientras la firma arranca.
    - Revocar solo esas claves, activar la monitorización de almacenamiento y bases de datos, y vigilar
      - Una respuesta proporcionada que te deja visibilidad. Existe una posibilidad real de que el actor pase a otra cosa antes de que la nueva monitorización lo vea.

### PH-03 El asistente habla

Día 3. El equipo revisa qué hizo el actor antes de perder el acceso.

- **INJ-06** (T+65′) {ai_assistant} ha entregado el mapa
- **POL-07** (T+80′) Qué hacer con el asistente
  - {ai_assistant} ha entregado el mapa de producción y la plantilla depende de él. ¿Qué haces?
    - Apagarlo y restringir el acceso a su base de conocimiento y a su fuente de datos
      - La fuga se detiene de inmediato. La plantilla pierde una herramienta de uso diario y en horas aparece el uso de IA por libre.
    - Mantenerlo activo y desconectar {internal_wiki} y la fuente que filtró
      - El servicio sigue y la fuente conocida queda cerrada. Otras fuentes conectadas siguen sin revisar, así que el arreglo vale lo que valga tu inventario.
    - Comprar y desplegar una monitorización específica de uso indebido de IA
      - Ganas visibilidad real con poca carga para el equipo. Comprar un producto nuevo bajo presión es caro y lento, y el actor no espera.
    - Limitar la base de conocimiento a lo necesario y añadir filtros de prompts y respuestas
      - El diseño correcto a largo plazo. Exige trabajo minucioso a un equipo sobrecargado, y quien ya tiene práctica puede saltarse los filtros.

### PH-04 Secretos en el código

Día 5. El acceso se cortó, pero el actor sigue llegando al entorno.

- **INJ-08** (T+100′) Una puerta trasera y secretos en los scripts
- **POL-09** (T+113′) Cómo rotar los secretos
  - Hay secretos repartidos por scripts y plantillas, y nadie sabe todo lo que alimentan. ¿Cómo los rotas?
    - Rotar a la vez todos los secretos de la organización y bloquear el acceso a las bases de datos
      - La puerta se cierra rápido y fuerte. Fallan servicios que no sabías que dependían de esos secretos, y los clientes lo notan.
    - Rotar las credenciales de bases de datos y los secretos encontrados, y revisar los repositorios más adelante
      - La exposición conocida se cierra con poco coste. Los secretos desconocidos siguen válidos hasta una revisión que nadie ha programado.
    - Contratar a una firma de recuperación para revisar todos los repositorios, buckets y plantillas, y rotar en orden con tu equipo
      - Rotar en orden mantiene en pie los servicios críticos, con un coste importante. La secuencia es lenta y el actor puede llegar a una credencial antes de su turno.
    - Pasar al equipo interno a turnos de 24 horas y buscar a mano
      - Sin factura y con control total. La gente cansada se equivoca, la búsqueda es lenta y tus mejores ingenieros recordarán este mes.

### PH-05 Los datos salen

Día 6. Llegan los registros de las últimas horas.

- **INJ-10** (T+128′) Los datos han salido
- **INJ-11** (contingente) La asesoría pide la decisión
- **INJ-12** (T+134′) La prensa pide comentario
- **INJ-13** (T+138′) Dos clientes empresa piden respuestas
- **INJ-14** (T+142′) La plantilla habla
- **POL-15** (T+150′) Cómo contarlo
  - Los datos han salido y todas las audiencias preguntan. ¿Cómo llevas la comunicación?
    - Informar a la vez a reguladores, afectados, clientes, plantilla y medios con un único portavoz, y ofrecer monitorización de crédito
      - Transparente y temprano, y los clientes lo valoran. Lo anunciado cambiará, y cada corrección cuesta credibilidad.
    - Cumplir todas las obligaciones de notificación y no decir más que una frase breve si preguntan
      - Limpio legalmente y barato. La historia la cuenta la prensa y los clientes se enteran antes por la prensa.
    - Montar comunicación de crisis con asesoría externa, confirmar qué salió e informar a cada audiencia por turnos
      - Cada declaración es exacta. La firma y la asesoría son caras, el trabajo forense vuelve a apretar al equipo y durante un tiempo no dices nada en público.
    - Notificar lo obligatorio, decir en público que el incidente está contenido y volver a la normalidad
      - Suena tranquilo un día. Si el actor publica algo, o el regulador discrepa, «contenido» pasa a ser el titular.

### PH-06 Las consecuencias

Tres semanas después. El incidente está cerrado y se redacta el informe final.

- **DSC-16** (T+163′) La rendición de cuentas ante el consejo
- **DSC-17** (T+171′) El informe forense

## Actores simulados

- **ACT-01** SOC
- **ACT-02** Proveedor de respuesta a incidentes (retainer)
- **ACT-03** CSIRT nacional
- **ACT-04** Supervisor financiero
- **ACT-05** Asesoría legal externa
- **ACT-06** Medios de comunicación
- **ACT-07** Cliente
- **ACT-08** Empleado
- **ACT-09** Presidencia del consejo

```json ttx-zone-scenario
{
  "format": "ttx-zone.scenario",
  "format_version": 8,
  "language": "es",
  "exported_at": "2026-11-05T00:00:00Z",
  "exercise": {
    "name": "Del paquete envenenado a los datos de producción",
    "description": "Un paquete malicioso de código abierto en el puesto de un desarrollador lleva, con claves cloud robadas y un asistente interno de IA, a la salida de datos de clientes de una entidad financiera. En cada paso los Jugadores votan una decisión, con los plazos de DORA y RGPD en marcha."
  },
  "needs": {
    "tlp": "amber",
    "triggers": [
      "regulatory",
      "new_threat"
    ],
    "trigger_other": "",
    "regulatory_frameworks": [
      "DORA",
      "GDPR"
    ],
    "regulatory_framework_other": "",
    "capabilities": [
      "crisis_decision_making",
      "regulatory_notification",
      "cross_unit_coordination",
      "internal_external_comms"
    ],
    "levels": [
      "strategic",
      "tactical"
    ],
    "participating_areas": [
      "Operaciones de seguridad",
      "Responsable del incidente",
      "CISO",
      "Equipo de plataforma cloud",
      "Ingeniería",
      "Responsable del asistente de IA",
      "Cumplimiento",
      "Delegado de protección de datos",
      "Legal",
      "Comunicación",
      "Consejero delegado",
      "Comité de crisis"
    ],
    "third_parties": [],
    "perimeter": "Puestos de desarrollo, plataforma cloud, asistente interno de IA, bases de datos de producción, notificación regulatoria y comunicación de crisis.",
    "out_of_scope": "Rediseñar la arquitectura cloud, elegir productos de seguridad y cualquier contacto real con las autoridades.",
    "max_duration_hours": 3,
    "confidentiality_restrictions": "",
    "budget_and_external_support": "",
    "stop_exercise_keyword": "GARZA GRIS",
    "needs": [
      {
        "code": "NEED-01",
        "source": "regulatory",
        "title": "Autoridad de contención poco clara",
        "finding": "Nadie ha ensayado quién puede bloquear a un equipo o parar un servicio de producción durante un incidente, ni con qué evidencia.",
        "affected_capability": "crisis_decision_making",
        "priority": "high"
      },
      {
        "code": "NEED-02",
        "source": "regulatory",
        "title": "DORA y RGPD nunca ensayados a la vez",
        "finding": "Los hitos de notificación de DORA y el plazo del RGPD nunca se han ejercitado en un mismo incidente, junto con clientes y prensa.",
        "affected_capability": "regulatory_notification",
        "priority": "high"
      },
      {
        "code": "NEED-03",
        "source": "regulatory",
        "title": "Asistentes de IA y secretos fuera del plan de respuesta",
        "finding": "El plan de respuesta no cubre los asistentes de IA internos, sus fuentes conectadas ni los secretos guardados en el código de despliegue.",
        "affected_capability": "cross_unit_coordination",
        "priority": "medium"
      }
    ],
    "objectives": [
      {
        "code": "OBJ-01",
        "title": "Contener sin parar el negocio",
        "statement": "Conocido el compromiso, el equipo decide hasta dónde contener, quién lo aprueba y qué le costará al negocio, con la evidencia disponible.",
        "capability": "crisis_decision_making",
        "need_codes": [
          "NEED-01"
        ],
        "success_criterion": "Responsable del incidente nombrado\nDecisión de contención registrada con quién la aprobó\nCambios de permisos revisados, no solo las claves",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "El registro del incidente y la decisión de contención.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-02",
        "title": "Cumplir los hitos de notificación de DORA",
        "statement": "El equipo clasifica el incidente y cumple los hitos de notificación inicial, intermedia y final con un contenido acorde a lo que se sabe.",
        "capability": "regulatory_notification",
        "need_codes": [
          "NEED-02"
        ],
        "success_criterion": "Clasificación registrada con hora y motivos\nNotificación inicial e informe intermedio enviados en plazo\nInforme final asignado",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "El registro de clasificación y los borradores de los informes.",
        "regulatory_requirement_ids": [
          "DORA-19"
        ]
      },
      {
        "code": "OBJ-03",
        "title": "Incorporar el asistente de IA a la respuesta",
        "statement": "El equipo trata el asistente de IA y sus fuentes conectadas como parte del incidente: localiza un responsable, qué exponen y decide si sigue en línea.",
        "capability": "cross_unit_coordination",
        "need_codes": [
          "NEED-03"
        ],
        "success_criterion": "Responsable identificado\nFuentes conectadas enumeradas\nDecisión sobre mantenerlo en línea registrada y usuarios informados",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "La lista de fuentes y la decisión.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-04",
        "title": "Rotar secretos en un orden seguro",
        "statement": "El equipo elimina la vía de regreso del actor y rota los secretos expuestos en un orden que protege los servicios críticos.",
        "capability": "cross_unit_coordination",
        "need_codes": [
          "NEED-03"
        ],
        "success_criterion": "Vía de regreso eliminada y resto de roles revisados\nDependencias de cada secreto conocidas antes de rotar\nOrden de rotación acordado con los dueños de los servicios",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "El plan de rotación.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-05",
        "title": "Notificar y contar una única versión",
        "statement": "Confirmada la salida de datos, el equipo decide la notificación del RGPD y da a reguladores, clientes, plantilla y medios mensajes coherentes con los hechos.",
        "capability": "internal_external_comms",
        "need_codes": [
          "NEED-02"
        ],
        "success_criterion": "Riesgo para las personas afectadas evaluado\nDecisión de notificar registrada con motivos\nDeclaración provisional, respuesta a clientes y mensaje interno alineados",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "La evaluación de la brecha y los mensajes.",
        "regulatory_requirement_ids": [
          "GDPR-33-34"
        ]
      }
    ],
    "risks": [
      {
        "risk": "Ocurre un incidente real durante la sesión.",
        "mitigation": "Cualquiera puede detener el ejercicio con la palabra clave."
      },
      {
        "risk": "El debate deriva hacia la política general de IA.",
        "mitigation": "El Facilitador devuelve a la mesa a la decisión que tiene delante."
      }
    ],
    "next_need_number": 4,
    "next_objective_number": 6
  },
  "msel": {
    "title": "Paquete envenenado",
    "summary": "{organization} es una entidad financiera cuyos equipos de desarrollo, asistente interno de IA y bases de datos de producción funcionan sobre {cloud_platform}. Lo que empieza como una alerta en un puesto se convierte, en seis días, en un incidente grave notificable y una brecha de datos personales.",
    "attack_version": "19.2",
    "duration_minutes": 180,
    "time_compression": 10,
    "phases": [
      {
        "code": "PH-01",
        "name": "El paquete",
        "start_offset": 0,
        "end_offset": 30,
        "incident_jump_minutes": 0,
        "situation_update": "Día 1, 09:00. Una mañana normal para los equipos de desarrollo de {organization}.",
        "key_questions": [
          "¿Cómo sabemos quién más lo instaló?",
          "¿Quién puede bloquear a un equipo entero y con qué evidencia?"
        ],
        "objectives": [],
        "headline": "Una actualización rutinaria sale mal"
      },
      {
        "code": "PH-02",
        "name": "Las claves robadas",
        "start_offset": 30,
        "end_offset": 60,
        "incident_jump_minutes": 0,
        "situation_update": "Día 1, unas horas después. La investigación pasa del puesto de trabajo a {cloud_platform}.",
        "key_questions": [
          "¿Cuándo empieza a contar DORA para nosotros y quién lo decide?",
          "¿Qué cambiaron las claves, además de lo que leyeron?"
        ],
        "objectives": [
          {
            "code": "OBJ-01",
            "due": true
          }
        ],
        "headline": "Claves robadas en uso en producción"
      },
      {
        "code": "PH-03",
        "name": "El asistente habla",
        "start_offset": 60,
        "end_offset": 95,
        "incident_jump_minutes": 2400,
        "situation_update": "Día 3. El equipo revisa qué hizo el actor antes de perder el acceso.",
        "key_questions": [
          "¿De quién es {ai_assistant} durante un incidente?",
          "¿Alguien revisó lo que sus fuentes podían revelar?"
        ],
        "objectives": [
          {
            "code": "OBJ-03",
            "due": true
          }
        ],
        "headline": "El chatbot interno entrega el mapa"
      },
      {
        "code": "PH-04",
        "name": "Secretos en el código",
        "start_offset": 95,
        "end_offset": 125,
        "incident_jump_minutes": 2400,
        "situation_update": "Día 5. El acceso se cortó, pero el actor sigue llegando al entorno.",
        "key_questions": [
          "¿Qué se rompe si rotamos este secreto ahora?",
          "¿Quién decide el orden cuando dos servicios compiten?"
        ],
        "objectives": [
          {
            "code": "OBJ-04",
            "due": true
          }
        ],
        "headline": "Una puerta trasera y credenciales en los scripts"
      },
      {
        "code": "PH-05",
        "name": "Los datos salen",
        "start_offset": 125,
        "end_offset": 160,
        "incident_jump_minutes": 1000,
        "situation_update": "Día 6. Llegan los registros de las últimas horas.",
        "key_questions": [
          "¿Qué sabemos con certeza y qué podemos decir hoy?",
          "¿Quién habla con cada audiencia y en qué orden?"
        ],
        "objectives": [
          {
            "code": "OBJ-02",
            "due": true
          },
          {
            "code": "OBJ-05",
            "due": true
          }
        ],
        "headline": "Los datos de clientes han salido y todos preguntan"
      },
      {
        "code": "PH-06",
        "name": "Las consecuencias",
        "start_offset": 160,
        "end_offset": 180,
        "incident_jump_minutes": 30240,
        "situation_update": "Tres semanas después. El incidente está cerrado y se redacta el informe final.",
        "key_questions": [
          "¿Qué decisión volveríamos a tomar?",
          "¿Qué mejora va primero?"
        ],
        "objectives": [],
        "headline": "La rendición de cuentas y el informe forense"
      }
    ],
    "threat_actors": [
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "THR-01",
        "name": "Actor sin identificar",
        "mitre_group_id": null,
        "aliases": [],
        "description": "Actor con motivación económica detrás del paquete envenenado, que pasa del puesto de un desarrollador a la nube y a los datos de producción.",
        "techniques": [
          {
            "domain": "enterprise",
            "technique_id": "T1195.001"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1552.001"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1078.004"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1580"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1619"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1213"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1098.003"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1530"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1074.002"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1567"
          }
        ]
      }
    ],
    "injects": [
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-01",
        "phase_code": "PH-01",
        "kind": "mandatory",
        "title": "Una dependencia que lee demasiado",
        "content": "La protección de endpoints marca el puesto de un desarrollador de {organization}. Minutos después de actualizar una dependencia de código abierto, su script de instalación se ejecutó, usó el asistente de programación con IA del equipo para buscar archivos locales y escribió un inventario de claves, tokens y archivos de configuración. Después hubo una conexión saliente a un host desconocido. Esa versión del paquete está en el lockfile compartido del equipo, así que otros pueden haberla instalado.",
        "offset_minutes": 5,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-01",
        "attack_attribution": "threat_actor",
        "threat_actor_code": "THR-01",
        "recipients": [
          "Operaciones de seguridad",
          "Ingeniería",
          "CISO"
        ],
        "delivery_method": "ticket",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0001",
            "technique_id": "T1195.001"
          },
          {
            "domain": "enterprise",
            "tactic_id": "TA0006",
            "technique_id": "T1552.001"
          }
        ],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-01"
        ],
        "expected_actions": [
          {
            "code": "INJ-01-A1",
            "description": "Aísla el puesto y conserva una copia forense antes de que nadie lo reinstale.",
            "responsible_role": "Operaciones de seguridad",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-01"
            ]
          },
          {
            "code": "INJ-01-A2",
            "description": "Enumera quién instaló esa versión del paquete y si algún pipeline de compilación la usó.",
            "responsible_role": "Ingeniería",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-01"
            ]
          },
          {
            "code": "INJ-01-A3",
            "description": "Abre un incidente y nombra a un responsable.",
            "responsible_role": "CISO",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-01"
            ]
          }
        ],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": null,
        "format": "inject",
        "poll_question": "",
        "poll_options": [],
        "poll_outcomes": [],
        "poll_impacts": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "POL-02",
        "phase_code": "PH-01",
        "kind": "mandatory",
        "title": "Hasta dónde contener",
        "content": "Todavía no sabes quién ejecutó el paquete.",
        "offset_minutes": 18,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": null,
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [],
        "delivery_method": "document",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "Cierra la votación confirmando la opción elegida y muestra el resultado: la mesa lee su consecuencia. El siguiente inject funciona gane la opción que gane. Cada decisión suma en los medidores: muestra su resumen en el hot wash.",
        "objective_codes": [],
        "expected_actions": [],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": null,
        "format": "poll",
        "poll_question": "El paquete está en un lockfile compartido y no sabes quién lo ejecutó. ¿Hasta dónde contienes?",
        "poll_options": [
          "Aislar el puesto, bloquear a todo el equipo de desarrollo y obligar a todos a identificarse de nuevo",
          "Aislar solo ese puesto y rotar las credenciales que contenía",
          "Bloquear el paquete en toda la organización y parar las compilaciones hasta limpiar el lockfile",
          "Dejar el puesto conectado y vigilado para ver qué hace el actor"
        ],
        "poll_outcomes": [
          "Se cierran todas las vías visibles, también las de quienes instalaron la misma versión. El equipo se detiene y lo lleva mal, pero nada trasciende fuera.",
          "Proporcionado y rápido, y el desarrollo sigue. Quien instalara el paquete queda expuesto hasta que alguien lo encuentre.",
          "La propagación se frena en origen y se corrige el lockfile. Se retrasan las entregas de todos los equipos, y lo robado ya no vuelve.",
          "Averiguas adónde va el actor, pero dejas a un ladrón activo en la red y tendrás que explicar esa decisión al supervisor."
        ],
        "poll_impacts": [
          {
            "m1": 2,
            "m2": 1,
            "m3": 2,
            "m4": 1
          },
          {
            "m1": 1,
            "m2": 3,
            "m3": 1,
            "m4": 1
          },
          {
            "m1": 3,
            "m2": 2,
            "m3": 2,
            "m4": 1
          },
          {
            "m2": 3,
            "m3": 2,
            "m4": 2,
            "m5": 1
          }
        ]
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-03",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "Claves robadas en uso en {cloud_platform}",
        "content": "El inventario que quedó en el puesto incluye claves de acceso de larga duración de {cloud_platform}, y ya se están usando. Los registros de auditoría y de detección de amenazas sitúan las llamadas detrás de una VPN comercial. Quien llama ha listado buckets de almacenamiento, ha leído y modificado políticas de permisos y ha enumerado agentes de IA y bases de conocimiento, y así ha llegado a {ai_assistant}, un chatbot interno al que estas credenciales tienen acceso. Se confirma el acceso no autorizado a producción.",
        "offset_minutes": 35,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-01",
        "attack_attribution": "threat_actor",
        "threat_actor_code": "THR-01",
        "recipients": [
          "Responsable del incidente",
          "Equipo de plataforma cloud",
          "Cumplimiento",
          "CISO"
        ],
        "delivery_method": "ticket",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0001",
            "technique_id": "T1078.004"
          },
          {
            "domain": "enterprise",
            "tactic_id": "TA0007",
            "technique_id": "T1580"
          },
          {
            "domain": "enterprise",
            "tactic_id": "TA0007",
            "technique_id": "T1619"
          }
        ],
        "facilitator_notes": "DORA: notificación inicial en 4 horas desde la clasificación como grave y como máximo 24 horas desde la detección. A4 anticipa la persistencia que el equipo encuentra el día 5.",
        "objective_codes": [
          "OBJ-01",
          "OBJ-02"
        ],
        "expected_actions": [
          {
            "code": "INJ-03-A1",
            "description": "Clasifica el incidente según DORA y registra cuándo y por qué.",
            "responsible_role": "Responsable del incidente",
            "expected_within_minutes": 8,
            "objective_codes": [
              "OBJ-02"
            ]
          },
          {
            "code": "INJ-03-A2",
            "description": "Envía la notificación inicial al supervisor financiero dentro del plazo.",
            "responsible_role": "Cumplimiento",
            "expected_within_minutes": 12,
            "objective_codes": [
              "OBJ-02"
            ]
          },
          {
            "code": "INJ-03-A3",
            "description": "Decide cómo cortar el acceso del actor y quién lo aprueba.",
            "responsible_role": "CISO",
            "expected_within_minutes": 12,
            "objective_codes": [
              "OBJ-01"
            ]
          },
          {
            "code": "INJ-03-A4",
            "description": "Revisa cada cambio de permisos hecho con las claves, no solo sus lecturas.",
            "responsible_role": "Equipo de plataforma cloud",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-01"
            ]
          }
        ],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": null,
        "format": "inject",
        "poll_question": "",
        "poll_options": [],
        "poll_outcomes": [],
        "poll_impacts": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-04",
        "phase_code": "PH-02",
        "kind": "contingent",
        "title": "El CSIRT nacional pregunta",
        "content": "Estamos viendo una versión maliciosa de un paquete de código abierto en varias entidades financieras, con claves cloud robadas usadas poco después. ¿Os ha afectado? En ese caso, confirmad que vuestro supervisor está informado.",
        "offset_minutes": null,
        "trigger_condition": "Sin notificación inicial 15 minutos después de INJ-03.",
        "contingent_purpose": "Devolver a la mesa el reloj de notificación.",
        "fires_at_minute": 20,
        "branch_from_code": "INJ-03",
        "branch_action_code": "INJ-03-A2",
        "rejoin_code": "INJ-06",
        "sender_code": "ACT-03",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Responsable del incidente",
          "Cumplimiento"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-02"
        ],
        "expected_actions": [
          {
            "code": "INJ-04-A1",
            "description": "Responde al CSIRT y registra la hora de la notificación al supervisor.",
            "responsible_role": "Cumplimiento",
            "expected_within_minutes": 8,
            "objective_codes": [
              "OBJ-02"
            ]
          }
        ],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": null,
        "format": "inject",
        "poll_question": "",
        "poll_options": [],
        "poll_outcomes": [],
        "poll_impacts": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "POL-05",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "El primer movimiento en la nube",
        "content": "Las claves se están usando en este momento.",
        "offset_minutes": 48,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": null,
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [],
        "delivery_method": "document",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "Cierra la votación confirmando la opción elegida y muestra el resultado: la mesa lee su consecuencia. El siguiente inject funciona gane la opción que gane. Cada decisión suma en los medidores: muestra su resumen en el hot wash.",
        "objective_codes": [],
        "expected_actions": [],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": null,
        "format": "poll",
        "poll_question": "Las claves robadas están activas y el actor explora. ¿Cuál es tu primer movimiento en {cloud_platform}?",
        "poll_options": [
          "Desactivar las claves robadas y obligar a toda la organización a cambiar sus credenciales",
          "Bloquear las direcciones de la VPN con una regla de denegación",
          "Contratar a una firma forense externa para mapear a qué llegan las identidades y buscar persistencia",
          "Revocar solo esas claves, activar la monitorización de almacenamiento y bases de datos, y vigilar"
        ],
        "poll_outcomes": [
          "El actor pierde esas claves de inmediato. Lo nota toda la empresa, el soporte se desborda y empiezan las preguntas.",
          "Rápido y barato, y da sensación de actuar. Una VPN comercial tiene muchas otras salidas, y el actor vuelve en menos de una hora.",
          "Conocerás el alcance y cualquier rastro de persistencia. Lleva días y dinero, y las claves siguen activas mientras la firma arranca.",
          "Una respuesta proporcionada que te deja visibilidad. Existe una posibilidad real de que el actor pase a otra cosa antes de que la nueva monitorización lo vea."
        ],
        "poll_impacts": [
          {
            "m1": 3,
            "m2": 1,
            "m3": 3,
            "m4": 2
          },
          {
            "m1": 1,
            "m2": 3,
            "m3": 1,
            "m4": 1
          },
          {
            "m1": 1,
            "m2": 3,
            "m3": 2,
            "m4": 1,
            "m5": 3
          },
          {
            "m1": 1,
            "m2": 2,
            "m3": 2,
            "m4": 1,
            "m5": 1
          }
        ]
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-06",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "{ai_assistant} ha entregado el mapa",
        "content": "Se cortara lo que se cortara el día 1, los registros muestran que el actor llegó antes a {ai_assistant}. Sus registros de invocación del modelo contienen largas sesiones de prompts que lo llevaron, paso a paso, a citar páginas de {internal_wiki}, conectada como fuente de conocimiento: nombres de host, endpoints y esquemas de {customer_database} y {finance_database}. Esas páginas no tenían contraseñas y aún no ha salido ningún dato, pero el actor ya tiene un mapa de producción.",
        "offset_minutes": 65,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-01",
        "attack_attribution": "threat_actor",
        "threat_actor_code": "THR-01",
        "recipients": [
          "Responsable del asistente de IA",
          "CISO",
          "Cumplimiento",
          "Responsable del incidente"
        ],
        "delivery_method": "ticket",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0009",
            "technique_id": "T1213"
          }
        ],
        "facilitator_notes": "DORA: informe intermedio en 72 horas desde la notificación inicial. ATT&CK no tiene una técnica para manipular un chatbot; la marcada cubre la lectura del conocimiento que hay detrás.",
        "objective_codes": [
          "OBJ-02",
          "OBJ-03"
        ],
        "expected_actions": [
          {
            "code": "INJ-06-A1",
            "description": "Enumera todas las fuentes conectadas a {ai_assistant} y qué expone cada una.",
            "responsible_role": "Responsable del asistente de IA",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-03"
            ]
          },
          {
            "code": "INJ-06-A2",
            "description": "Decide si {ai_assistant} sigue en línea e informa a sus usuarios.",
            "responsible_role": "CISO",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-03"
            ]
          },
          {
            "code": "INJ-06-A3",
            "description": "Envía el informe intermedio al supervisor con el nuevo alcance.",
            "responsible_role": "Cumplimiento",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-02"
            ]
          }
        ],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": null,
        "format": "inject",
        "poll_question": "",
        "poll_options": [],
        "poll_outcomes": [],
        "poll_impacts": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "POL-07",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "Qué hacer con el asistente",
        "content": "El actor tiene la ruta a producción, pero aún no las credenciales.",
        "offset_minutes": 80,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": null,
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [],
        "delivery_method": "document",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "Cierra la votación confirmando la opción elegida y muestra el resultado: la mesa lee su consecuencia. El siguiente inject funciona gane la opción que gane. Cada decisión suma en los medidores: muestra su resumen en el hot wash.",
        "objective_codes": [],
        "expected_actions": [],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": null,
        "format": "poll",
        "poll_question": "{ai_assistant} ha entregado el mapa de producción y la plantilla depende de él. ¿Qué haces?",
        "poll_options": [
          "Apagarlo y restringir el acceso a su base de conocimiento y a su fuente de datos",
          "Mantenerlo activo y desconectar {internal_wiki} y la fuente que filtró",
          "Comprar y desplegar una monitorización específica de uso indebido de IA",
          "Limitar la base de conocimiento a lo necesario y añadir filtros de prompts y respuestas"
        ],
        "poll_outcomes": [
          "La fuga se detiene de inmediato. La plantilla pierde una herramienta de uso diario y en horas aparece el uso de IA por libre.",
          "El servicio sigue y la fuente conocida queda cerrada. Otras fuentes conectadas siguen sin revisar, así que el arreglo vale lo que valga tu inventario.",
          "Ganas visibilidad real con poca carga para el equipo. Comprar un producto nuevo bajo presión es caro y lento, y el actor no espera.",
          "El diseño correcto a largo plazo. Exige trabajo minucioso a un equipo sobrecargado, y quien ya tiene práctica puede saltarse los filtros."
        ],
        "poll_impacts": [
          {
            "m1": 3,
            "m2": 1,
            "m3": 2,
            "m4": 1
          },
          {
            "m1": 1,
            "m2": 2,
            "m3": 1,
            "m4": 1
          },
          {
            "m1": 2,
            "m2": 2,
            "m3": 1,
            "m5": 3
          },
          {
            "m1": 1,
            "m2": 2,
            "m3": 3,
            "m4": 1,
            "m5": 1
          }
        ]
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-08",
        "phase_code": "PH-04",
        "kind": "mandatory",
        "title": "Una puerta trasera y secretos en los scripts",
        "content": "El actor ya no tiene clave propia y sigue entrando. Al repasar los cambios de permisos del día 1, el equipo encuentra una cuenta externa añadida a la política de confianza de un rol de despliegue, que el actor asume cuando quiere. Desde ahí pasó un escáner de secretos por los buckets con scripts de despliegue e infraestructura como código, y encontró secretos en claro, entre ellos credenciales de bases de datos. Las actualizaciones al supervisor y al CSIRT nacional siguen saliendo según lo previsto.",
        "offset_minutes": 100,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-02",
        "attack_attribution": "threat_actor",
        "threat_actor_code": "THR-01",
        "recipients": [
          "Equipo de plataforma cloud",
          "Ingeniería",
          "Responsable del incidente",
          "Cumplimiento"
        ],
        "delivery_method": "briefing",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0003",
            "technique_id": "T1098.003"
          },
          {
            "domain": "enterprise",
            "tactic_id": "TA0006",
            "technique_id": "T1552.001"
          }
        ],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-04"
        ],
        "expected_actions": [
          {
            "code": "INJ-08-A1",
            "description": "Retira la cuenta externa de la política de confianza y revisa el resto de roles.",
            "responsible_role": "Equipo de plataforma cloud",
            "expected_within_minutes": 8,
            "objective_codes": [
              "OBJ-04"
            ]
          },
          {
            "code": "INJ-08-A2",
            "description": "Enumera a qué alimenta cada secreto expuesto antes de rotarlo.",
            "responsible_role": "Ingeniería",
            "expected_within_minutes": 12,
            "objective_codes": [
              "OBJ-04"
            ]
          },
          {
            "code": "INJ-08-A3",
            "description": "Decide el orden de rotación con los dueños de los servicios, con {customer_database} y {finance_database} primero.",
            "responsible_role": "Responsable del incidente",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-04"
            ]
          }
        ],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": null,
        "format": "inject",
        "poll_question": "",
        "poll_options": [],
        "poll_outcomes": [],
        "poll_impacts": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "POL-09",
        "phase_code": "PH-04",
        "kind": "mandatory",
        "title": "Cómo rotar los secretos",
        "content": "Cortar el secreto equivocado puede parar un servicio.",
        "offset_minutes": 113,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": null,
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [],
        "delivery_method": "document",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "Cierra la votación confirmando la opción elegida y muestra el resultado: la mesa lee su consecuencia. El siguiente inject funciona gane la opción que gane. Cada decisión suma en los medidores: muestra su resumen en el hot wash.",
        "objective_codes": [],
        "expected_actions": [],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": null,
        "format": "poll",
        "poll_question": "Hay secretos repartidos por scripts y plantillas, y nadie sabe todo lo que alimentan. ¿Cómo los rotas?",
        "poll_options": [
          "Rotar a la vez todos los secretos de la organización y bloquear el acceso a las bases de datos",
          "Rotar las credenciales de bases de datos y los secretos encontrados, y revisar los repositorios más adelante",
          "Contratar a una firma de recuperación para revisar todos los repositorios, buckets y plantillas, y rotar en orden con tu equipo",
          "Pasar al equipo interno a turnos de 24 horas y buscar a mano"
        ],
        "poll_outcomes": [
          "La puerta se cierra rápido y fuerte. Fallan servicios que no sabías que dependían de esos secretos, y los clientes lo notan.",
          "La exposición conocida se cierra con poco coste. Los secretos desconocidos siguen válidos hasta una revisión que nadie ha programado.",
          "Rotar en orden mantiene en pie los servicios críticos, con un coste importante. La secuencia es lenta y el actor puede llegar a una credencial antes de su turno.",
          "Sin factura y con control total. La gente cansada se equivoca, la búsqueda es lenta y tus mejores ingenieros recordarán este mes."
        ],
        "poll_impacts": [
          {
            "m1": 3,
            "m2": 1,
            "m3": 3,
            "m4": 2,
            "m5": 1
          },
          {
            "m1": 1,
            "m2": 3,
            "m3": 2,
            "m4": 1
          },
          {
            "m1": 1,
            "m2": 2,
            "m3": 2,
            "m4": 1,
            "m5": 3
          },
          {
            "m1": 1,
            "m2": 3,
            "m3": 3,
            "m4": 1
          }
        ]
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-10",
        "phase_code": "PH-05",
        "kind": "mandatory",
        "title": "Los datos han salido",
        "content": "Una credencial de base de datos se usó antes de que su rotación tuviera efecto, con actividad en {customer_database} y {finance_database}. Los registros de almacenamiento muestran datos de producción, datos personales de clientes y registros financieros copiados a un bucket, una URL prefirmada generada y los archivos descargados desde una dirección externa. Las notificaciones intermedias están al día y el informe final de DORA vence en un mes. Ya es una brecha de datos personales y se aplica el plazo del RGPD.",
        "offset_minutes": 128,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-02",
        "attack_attribution": "threat_actor",
        "threat_actor_code": "THR-01",
        "recipients": [
          "Responsable del incidente",
          "Delegado de protección de datos",
          "Legal",
          "Cumplimiento",
          "Comité de crisis"
        ],
        "delivery_method": "briefing",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0009",
            "technique_id": "T1530"
          },
          {
            "domain": "enterprise",
            "tactic_id": "TA0009",
            "technique_id": "T1074.002"
          },
          {
            "domain": "enterprise",
            "tactic_id": "TA0010",
            "technique_id": "T1567"
          }
        ],
        "facilitator_notes": "RGPD: notificar a la autoridad en 72 horas desde el conocimiento e informar sin dilación a las personas afectadas si el riesgo es alto. DORA: informe final en un mes desde el informe intermedio.",
        "objective_codes": [
          "OBJ-02",
          "OBJ-05"
        ],
        "expected_actions": [
          {
            "code": "INJ-10-A1",
            "description": "Evalúa el riesgo para las personas afectadas y decide sobre la notificación a la autoridad de protección de datos.",
            "responsible_role": "Delegado de protección de datos",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-05"
            ]
          },
          {
            "code": "INJ-10-A2",
            "description": "Confirma qué salió, de qué sistemas y a cuántas personas afecta.",
            "responsible_role": "Responsable del incidente",
            "expected_within_minutes": 12,
            "objective_codes": [
              "OBJ-05"
            ]
          },
          {
            "code": "INJ-10-A3",
            "description": "Asigna el informe final de DORA y su fecha.",
            "responsible_role": "Cumplimiento",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-02"
            ]
          }
        ],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": null,
        "format": "inject",
        "poll_question": "",
        "poll_options": [],
        "poll_outcomes": [],
        "poll_impacts": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-11",
        "phase_code": "PH-05",
        "kind": "contingent",
        "title": "La asesoría pide la decisión",
        "content": "Las 72 horas empezaron cuando confirmasteis la brecha. Si decidís no notificar, necesitamos los motivos por escrito. Si notificáis, puede salir ya un primer aviso y completarlo por fases. ¿Qué hacemos?",
        "offset_minutes": null,
        "trigger_condition": "Sin decisión sobre notificar a la autoridad 10 minutos después de INJ-10.",
        "contingent_purpose": "Forzar la decisión de notificar.",
        "fires_at_minute": 14,
        "branch_from_code": "INJ-10",
        "branch_action_code": "INJ-10-A1",
        "rejoin_code": "POL-15",
        "sender_code": "ACT-05",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Delegado de protección de datos",
          "Legal"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-05"
        ],
        "expected_actions": [
          {
            "code": "INJ-11-A1",
            "description": "Registra la decisión de notificar y sus motivos.",
            "responsible_role": "Delegado de protección de datos",
            "expected_within_minutes": 8,
            "objective_codes": [
              "OBJ-05"
            ]
          }
        ],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": null,
        "format": "inject",
        "poll_question": "",
        "poll_options": [],
        "poll_outcomes": [],
        "poll_impacts": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-12",
        "phase_code": "PH-05",
        "kind": "mandatory",
        "title": "La prensa pide comentario",
        "content": "Según mis fuentes, {organization} ha sufrido una brecha con datos de clientes. ¿Podéis confirmarlo? Publico esta tarde y querría vuestro comentario antes de las 16:00.",
        "offset_minutes": 134,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-06",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Comunicación",
          "Legal"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-05"
        ],
        "expected_actions": [
          {
            "code": "INJ-12-A1",
            "description": "Acuerda con Legal una declaración provisional que solo diga lo confirmado.",
            "responsible_role": "Comunicación",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-05"
            ]
          }
        ],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": {
          "kind": "email",
          "sender": "Redacción de tecnología",
          "sender_address": "newsdesk@press.example.org",
          "recipient": "Gabinete de prensa",
          "subject": "Petición de comentario: posible brecha de datos",
          "timestamp": "Día 6, 11:40",
          "location": ""
        },
        "format": "inject",
        "poll_question": "",
        "poll_options": [],
        "poll_outcomes": [],
        "poll_impacts": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-13",
        "phase_code": "PH-05",
        "kind": "mandatory",
        "title": "Dos clientes empresa piden respuestas",
        "content": "Nos ha llegado que {organization} tiene un incidente de seguridad. Nuestro equipo de riesgos necesita confirmación escrita hoy sobre si nuestros datos están afectados y qué estáis haciendo. Otro cliente corporativo ha enviado la misma petición.",
        "offset_minutes": 138,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-07",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Comunicación",
          "Responsable del incidente"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-05"
        ],
        "expected_actions": [
          {
            "code": "INJ-13-A1",
            "description": "Asigna un único responsable de las respuestas a clientes y las alinea con lo comunicado a los reguladores.",
            "responsible_role": "Comunicación",
            "expected_within_minutes": 12,
            "objective_codes": [
              "OBJ-05"
            ]
          }
        ],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": {
          "kind": "email",
          "sender": "Responsable de riesgo de terceros, cliente empresa",
          "sender_address": "vendor.risk@customer.example.com",
          "recipient": "Gestor de la cuenta",
          "subject": "Urgente: confirmación sobre nuestros datos",
          "timestamp": "Día 6, 12:05",
          "location": ""
        },
        "format": "inject",
        "poll_question": "",
        "poll_options": [],
        "poll_outcomes": [],
        "poll_impacts": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-14",
        "phase_code": "PH-05",
        "kind": "mandatory",
        "title": "La plantilla habla",
        "content": "¿Es verdad que nos han hackeado? Mi equipo no puede usar el chatbot, los desarrolladores llevan toda la noche despiertos y un cliente acaba de preguntarme. ¿Qué se supone que tenemos que decir?",
        "offset_minutes": 142,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-08",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Comunicación",
          "Comité de crisis"
        ],
        "delivery_method": "chat",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-05"
        ],
        "expected_actions": [
          {
            "code": "INJ-14-A1",
            "description": "Envía a la plantilla un mensaje interno con qué decir y adónde dirigir las preguntas.",
            "responsible_role": "Comunicación",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-05"
            ]
          }
        ],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": {
          "kind": "chat_message",
          "sender": "Persona de la plantilla",
          "sender_address": "",
          "recipient": "",
          "subject": "",
          "timestamp": "Día 6, 12:20",
          "location": "#general"
        },
        "format": "inject",
        "poll_question": "",
        "poll_options": [],
        "poll_outcomes": [],
        "poll_impacts": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "POL-15",
        "phase_code": "PH-05",
        "kind": "mandatory",
        "title": "Cómo contarlo",
        "content": "Reguladores, clientes, plantilla y prensa están esperando.",
        "offset_minutes": 150,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": null,
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [],
        "delivery_method": "document",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "Cierra la votación confirmando la opción elegida y muestra el resultado: la mesa lee su consecuencia. El siguiente inject funciona gane la opción que gane. Cada decisión suma en los medidores: muestra su resumen en el hot wash.",
        "objective_codes": [],
        "expected_actions": [],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": null,
        "format": "poll",
        "poll_question": "Los datos han salido y todas las audiencias preguntan. ¿Cómo llevas la comunicación?",
        "poll_options": [
          "Informar a la vez a reguladores, afectados, clientes, plantilla y medios con un único portavoz, y ofrecer monitorización de crédito",
          "Cumplir todas las obligaciones de notificación y no decir más que una frase breve si preguntan",
          "Montar comunicación de crisis con asesoría externa, confirmar qué salió e informar a cada audiencia por turnos",
          "Notificar lo obligatorio, decir en público que el incidente está contenido y volver a la normalidad"
        ],
        "poll_outcomes": [
          "Transparente y temprano, y los clientes lo valoran. Lo anunciado cambiará, y cada corrección cuesta credibilidad.",
          "Limpio legalmente y barato. La historia la cuenta la prensa y los clientes se enteran antes por la prensa.",
          "Cada declaración es exacta. La firma y la asesoría son caras, el trabajo forense vuelve a apretar al equipo y durante un tiempo no dices nada en público.",
          "Suena tranquilo un día. Si el actor publica algo, o el regulador discrepa, «contenido» pasa a ser el titular."
        ],
        "poll_impacts": [
          {
            "m1": 1,
            "m3": 3,
            "m4": 2,
            "m5": 3
          },
          {
            "m1": 1,
            "m3": 2,
            "m4": 3,
            "m5": 1
          },
          {
            "m1": 1,
            "m3": 3,
            "m4": 2,
            "m5": 3
          },
          {
            "m1": 1,
            "m2": 3,
            "m3": 1,
            "m4": 3
          }
        ]
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "DSC-16",
        "phase_code": "PH-06",
        "kind": "mandatory",
        "title": "La rendición de cuentas ante el consejo",
        "content": "Tres semanas después, la presidencia del consejo pide una explicación clara: qué ha costado el incidente, qué piensan ahora los clientes, qué preguntarán los reguladores y cuánto durará el daño. ¿Qué decisiones se sostienen y cuáles tomarías de otro modo?",
        "offset_minutes": 163,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-09",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Consejero delegado",
          "Comité de crisis"
        ],
        "delivery_method": "in_person",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "Usa la cuenta de las votaciones. Si presupuesto y estrés terminaron altos, quizá los clientes se quedaron, pero la recuperación llevará varios trimestres y puede irse gente. Si el riesgo del actor siguió alto, pregunta qué sigue abierto. Si legal y marca acabaron altos, empieza por lo que se dijo en público. No hay camino perfecto: cada opción compró algo y costó algo.",
        "objective_codes": [],
        "expected_actions": [],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": null,
        "format": "discussion",
        "poll_question": "",
        "poll_options": [],
        "poll_outcomes": [],
        "poll_impacts": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "DSC-17",
        "phase_code": "PH-06",
        "kind": "mandatory",
        "title": "El informe forense",
        "content": "La firma forense presenta la ruta del ataque: un paquete envenenado en el puesto de un desarrollador, claves robadas, una política de confianza alterada, {ai_assistant} y {internal_wiki}, secretos en claro, las bases de producción y la salida de datos por una URL prefirmada. ¿En qué paso podría haberlo detenido la organización con menor coste y qué debe cambiar primero?",
        "offset_minutes": 171,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-02",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "CISO",
          "Responsable del incidente",
          "Comité de crisis"
        ],
        "delivery_method": "briefing",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "Recorre el diagrama paso a paso y anota las mejoras para el informe posterior: fijar y revisar dependencias, credenciales cloud de corta duración, un responsable y una revisión de fuentes por cada asistente de IA, escaneo de secretos en los pipelines y alertas sobre cambios en políticas de confianza.",
        "objective_codes": [],
        "expected_actions": [],
        "images": [
          {
            "image": "IMG-01",
            "caption": "Ruta de ataque ficticia, solo para uso en el ejercicio."
          }
        ],
        "room_codes": [],
        "files": [],
        "artifact": null,
        "format": "discussion",
        "poll_question": "",
        "poll_options": [],
        "poll_outcomes": [],
        "poll_impacts": []
      }
    ],
    "next_phase_number": 7,
    "next_inject_number": 18,
    "next_threat_actor_number": 2,
    "meters": [
      {
        "key": "m1",
        "name": "Disrupción"
      },
      {
        "key": "m2",
        "name": "Riesgo del actor"
      },
      {
        "key": "m3",
        "name": "Estrés del equipo"
      },
      {
        "key": "m4",
        "name": "Legal y marca"
      },
      {
        "key": "m5",
        "name": "Presupuesto"
      }
    ]
  },
  "cast": [
    {
      "origin": "system",
      "origin_id": "soc",
      "origin_name": "SOC",
      "code": "ACT-01",
      "name": "SOC",
      "type": "soc",
      "description": "El centro de operaciones de seguridad: alertas, hallazgos y peticiones de decisión.",
      "channel": "ticket"
    },
    {
      "origin": "system",
      "origin_id": "dfir-provider",
      "origin_name": "Proveedor de respuesta a incidentes (retainer)",
      "code": "ACT-02",
      "name": "Proveedor de respuesta a incidentes (retainer)",
      "type": "supplier",
      "description": "El equipo externo de respuesta y forense, normalmente con un contrato (retainer) que se activa durante el incidente: hallazgos, informes y recomendaciones de contención.",
      "channel": "briefing"
    },
    {
      "origin": "system",
      "origin_id": "national-csirt",
      "origin_name": "CSIRT nacional",
      "code": "ACT-03",
      "name": "CSIRT nacional",
      "type": "csirt",
      "description": "El equipo nacional de respuesta a incidentes: pide notificaciones y comparte indicadores.",
      "channel": "email"
    },
    {
      "origin": "system",
      "origin_id": "financial-supervisor",
      "origin_name": "Supervisor financiero",
      "code": "ACT-04",
      "name": "Supervisor financiero",
      "type": "authority",
      "description": "El supervisor del sector financiero que recibe las notificaciones de incidentes TIC graves.",
      "channel": "email"
    },
    {
      "origin": "system",
      "origin_id": "external-counsel",
      "origin_name": "Asesoría legal externa",
      "code": "ACT-05",
      "name": "Asesoría legal externa",
      "type": "other",
      "description": "Abogados externos que asesoran sobre notificaciones, responsabilidad y comunicación.",
      "channel": "email"
    },
    {
      "origin": "system",
      "origin_id": "media",
      "origin_name": "Medios de comunicación",
      "code": "ACT-06",
      "name": "Medios de comunicación",
      "type": "media",
      "description": "Periodistas que preguntan o publican sobre el incidente.",
      "channel": "media"
    },
    {
      "origin": "system",
      "origin_id": "customer",
      "origin_name": "Cliente",
      "code": "ACT-07",
      "name": "Cliente",
      "type": "customer",
      "description": "Un cliente que nota el impacto y pide explicaciones.",
      "channel": "email"
    },
    {
      "origin": "system",
      "origin_id": "insider",
      "origin_name": "Empleado",
      "code": "ACT-08",
      "name": "Empleado",
      "type": "internal",
      "description": "Un empleado que avisa de algo extraño, o el insider que está detrás.",
      "channel": "in_person"
    },
    {
      "origin": "system",
      "origin_id": "board-chair",
      "origin_name": "Presidencia del consejo",
      "code": "ACT-09",
      "name": "Presidencia del consejo",
      "type": "internal",
      "description": "La presidencia del consejo de administración cuando el consejo no juega: pide explicaciones y convoca sesiones.",
      "channel": "phone"
    }
  ],
  "next_actor_number": 10,
  "tags": [
    {
      "origin": "system",
      "origin_id": "supply-chain",
      "origin_name": "Cadena de suministro",
      "name": "Cadena de suministro",
      "color": "rose",
      "custom_hex": null,
      "applied": true
    },
    {
      "origin": "system",
      "origin_id": "cloud",
      "origin_name": "Cloud",
      "name": "Cloud",
      "color": "rose",
      "custom_hex": null,
      "applied": true
    },
    {
      "origin": "system",
      "origin_id": "data-breach",
      "origin_name": "Fuga de datos",
      "name": "Fuga de datos",
      "color": "rose",
      "custom_hex": null,
      "applied": true
    },
    {
      "origin": "system",
      "origin_id": "dora",
      "origin_name": "DORA",
      "name": "DORA",
      "color": "slate",
      "custom_hex": null,
      "applied": true
    },
    {
      "origin": "system",
      "origin_id": "gdpr",
      "origin_name": "RGPD",
      "name": "RGPD",
      "color": "slate",
      "custom_hex": null,
      "applied": true
    },
    {
      "origin": "system",
      "origin_id": "crisis-committee",
      "origin_name": "Comité de crisis",
      "name": "Comité de crisis",
      "color": "indigo",
      "custom_hex": null,
      "applied": true
    }
  ],
  "images": [
    {
      "key": "IMG-01",
      "content_type": "image/png",
      "data": "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FxaURqPVarXOLgYqTIlwg9Otzd3QomVLf3//zz79eOGC+cqfX341ddKkR1+f8mr5Gw7s3y8jI+Mf/qaff/rJt1O/LmeF0Nq19+7d/cJzz/7DGStWg7756suPcnPz8/I5OAEAAAACDf/VcMOwYSPi4+LmL5j3/PMv1qsXcfr0KRFxMjh98cXX9SLqa7XajIyMN15/df++faUu/PjTzzPS0154/rngaiGff/5lQGCgiMQnxD3z1JNXr1x55dUpdevWFbW6Vs1aNpttw/rf//fGlKKf7uLs8vXU7+uE1VGr1RcvXlSpr49PqVo1+LPPv6waHGwymQ4dPPjsM0+WNRzj2+9/jIior1arjUbjzz9PmzH9VxF5YfJLffv2c3BwLCws+PXXX86eifrwo09F5N33PtyyedMbr7/2+JNPDR48zMnJMT+/YN6cWT/++L2jo8Pv6zd/++03993/QFpa+qgRQwk3lM/bu4qIODu7KH/u37dv/ry58fHxIhISEvLVN99WqeKrUqlycnKef/apY8eO2TecPXf+jz98t3DB/LDw8I8//dzH28dmsx09esS+wgsvTu53zwC9Xm+1Wvfs3vX8c89U/piZeN99PXr2GnBP31KPyfUbNzs7O7dp027egkUjhw/9y8PDZrNdu3q1XkQ9d3ePnJycD99/77kXXvTw8DAWFn744QdrVq8s9cgsvwY5Ojp88ukXDRs11mq1mZmZ77z1v127dnbq3OW1KW/s2rWzc+cuWq02JiZmwrgxJpORRg8AAAC4uwINyhMi/r/CDcrrAf16VmST4GohAQEBX3/15fKlS5599vmHJj369JOPicgXX3xdv0HDX3756eqVq089/fTHH3/WsUPbUhd6e/uoVCqVSvXr9BlqteajD9/TqLVPPf3Mr9Nn9OrRzcvLK7R2nVOnTr704vPjJkzs2av3T9N+TEiIt2fgm2+/r12nzrQff7h8Of6Jp57R6XQiolKpfpn+m8lkfuXlybVCQ++//8H/vfl2sQiF4tnnX2zQoOEvP087duzo5Mmv3H/fAzOm/zp+/ITBg4du2rhh8+ZNEyfeO2nSo08+/uhv03998KGH161ds3rVijFjxo8ZM27nzu3Lli4bNnzEvfc/kJycvP73dXoHhyefeiYq6vSSxYvl//sJESU1WXTxlteseLih4ils2bLx2eeef3jSI8OGjzh5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"
    }
  ],
  "uses_rooms": false,
  "rooms": [],
  "next_room_number": 1,
  "files": []
}
```
