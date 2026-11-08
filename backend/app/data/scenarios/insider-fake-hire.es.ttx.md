---
format: "ttx-zone.scenario"
format_version: 3
language: "es"
title: "El desarrollador remoto que no era quien decía"
exported_at: "2026-10-31T00:00:00+00:00"
generator: "ttx-zone"
attack_version: "19.2"
---

# El desarrollador remoto que no era quien decía

Un contratista remoto contratado a través de una agencia resulta ser la tapadera de un esquema respaldado por un Estado. Las señales raras se acumulan, se rescinde el contrato y, días después, un correo anónimo exige un pago para no publicar el código fuente robado. Seguridad, Recursos Humanos y Legal deben actuar juntos, dentro de la ley, y decidir sobre una extorsión que puede implicar a una parte sancionada.

> Escenario de TTX-Zone. Impórtalo desde Biblioteca → Escenarios. La parte legible se genera al exportar; solo se importa el bloque de datos del final.

## Objetivos

- **OBJ-01** Anomalías atendidas
- **OBJ-02** Respuesta legal y coordinada
- **OBJ-03** Decisión sobre extorsión y sanciones

## Escenario

Siete meses después de empezar un contrato remoto, un desarrollador de {organization} trabaja bien pero casi nunca enciende la cámara. Entonces el SOC detecta una herramienta de acceso remoto en su portátil.

## Fases e injects

### PH-01 Señales raras

Séptimo mes de un contrato remoto. Se acumulan pequeñas anomalías.

- **INJ-01** (T+5′) Una herramienta de acceso remoto en el portátil de un contratista
- **INJ-02** (T+25′) Nóminas detecta una cuenta bancaria nueva

### PH-02 Tras la rescisión

Dos días después. Se ha rescindido el contrato; empieza la investigación.

- **INJ-03** (T+55′) Repositorios clonados y claves descargadas
- **INJ-04** (T+85′) El perfil encaja con un esquema sancionado

### PH-03 La exigencia

Una semana después. Un correo anónimo adjunta muestras del código fuente.

- **INJ-05** (T+115′) Pagar o se publica el código
- **INJ-06** (T+140′) Un cliente pregunta si su código quedó expuesto

## Actores simulados

- **ACT-01** SOC
- **ACT-02** Empleado
- **ACT-03** Proveedor de respuesta a incidentes (retainer)
- **ACT-04** Proveedor de inteligencia de amenazas
- **ACT-05** Atacante (remitente)
- **ACT-06** Cliente

```json ttx-zone-scenario
{
  "format": "ttx-zone.scenario",
  "format_version": 3,
  "language": "es",
  "exported_at": "2026-10-31T00:00:00Z",
  "exercise": {
    "name": "El desarrollador remoto que no era quien decía",
    "description": "Un contratista remoto contratado a través de una agencia resulta ser la tapadera de un esquema respaldado por un Estado. Las señales raras se acumulan, se rescinde el contrato y, días después, un correo anónimo exige un pago para no publicar el código fuente robado. Seguridad, Recursos Humanos y Legal deben actuar juntos, dentro de la ley, y decidir sobre una extorsión que puede implicar a una parte sancionada."
  },
  "needs": {
    "tlp": "amber",
    "triggers": [
      "new_threat",
      "annual_program"
    ],
    "trigger_other": "",
    "regulatory_frameworks": [],
    "regulatory_framework_other": "",
    "capabilities": [
      "crisis_decision_making",
      "detection_triage_escalation",
      "legal_forensics"
    ],
    "levels": [
      "strategic",
      "tactical"
    ],
    "participating_areas": [
      "Comité de crisis",
      "Operaciones de seguridad",
      "Recursos Humanos",
      "Legal",
      "TI",
      "Comunicación",
      "CISO",
      "Responsable de operaciones de seguridad",
      "Responsable de Recursos Humanos",
      "Director de TI",
      "Responsable de comunicación"
    ],
    "third_parties": [
      "Agencia de contratación"
    ],
    "perimeter": "Los contratistas remotos, el código fuente y los entornos cloud, y los equipos de seguridad, Recursos Humanos, Legal y crisis.",
    "out_of_scope": "Los cambios en el proceso de contratación.",
    "max_duration_hours": 3,
    "confidentiality_restrictions": "",
    "budget_and_external_support": "",
    "stop_exercise_keyword": "EMPTY DESK",
    "needs": [
      {
        "code": "NEED-01",
        "source": "threat_intel",
        "title": "Anomalías en portátiles sin cruzar con datos de RR. HH.",
        "finding": "Seguridad ve señales de los equipos y RR. HH. ve cambios en nóminas; nadie las junta.",
        "affected_capability": "detection_triage_escalation",
        "priority": "high"
      },
      {
        "code": "NEED-02",
        "source": "risk_analysis",
        "title": "Sin procedimiento conjunto para casos internos",
        "finding": "Recursos Humanos, Legal y seguridad nunca han acordado quién lidera una investigación interna ni qué vigilancia es legal.",
        "affected_capability": "legal_forensics",
        "priority": "high"
      },
      {
        "code": "NEED-03",
        "source": "regulatory",
        "title": "Sin postura sobre extorsión y sanciones",
        "finding": "Nunca se ha hablado de pagar, o de haber pagado, a una parte sancionada.",
        "affected_capability": "crisis_decision_making",
        "priority": "medium"
      }
    ],
    "objectives": [
      {
        "code": "OBJ-01",
        "title": "Anomalías atendidas",
        "statement": "Seguridad, Recursos Humanos y TI juntan las señales y acuerdan una respuesta antes de alertar al contratista.",
        "capability": "detection_triage_escalation",
        "need_codes": [
          "NEED-01"
        ],
        "success_criterion": "Señales compartidas entre equipos\nRespuesta acordada",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Registro del caso.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-02",
        "title": "Respuesta legal y coordinada",
        "statement": "Recursos Humanos, Legal y seguridad acuerdan quién lidera, qué vigilancia es legal y cómo se corta el acceso y se conservan las pruebas.",
        "capability": "legal_forensics",
        "need_codes": [
          "NEED-02"
        ],
        "success_criterion": "Responsable nombrado\nAcceso cortado y secretos rotados\nPruebas conservadas",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Registro de la investigación.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-03",
        "title": "Decisión sobre extorsión y sanciones",
        "statement": "El comité decide sobre la exigencia, la denuncia, la comunicación a las autoridades de sanciones y qué se dice a los clientes.",
        "capability": "crisis_decision_making",
        "need_codes": [
          "NEED-03"
        ],
        "success_criterion": "Decisión y motivos registrados\nMensaje a clientes acordado",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Actas del comité.",
        "regulatory_requirement_ids": []
      }
    ],
    "risks": [
      {
        "risk": "Ocurre un incidente real durante la sesión.",
        "mitigation": "Cualquiera puede detener el ejercicio con la palabra clave de parada."
      }
    ],
    "next_need_number": 4,
    "next_objective_number": 4
  },
  "msel": {
    "title": "Un buen desarrollador, un portátil extraño",
    "summary": "Siete meses después de empezar un contrato remoto, un desarrollador de {organization} trabaja bien pero casi nunca enciende la cámara. Entonces el SOC detecta una herramienta de acceso remoto en su portátil.",
    "attack_version": "19.2",
    "duration_minutes": 170,
    "time_compression": 60,
    "phases": [
      {
        "code": "PH-01",
        "name": "Señales raras",
        "start_offset": 0,
        "end_offset": 50,
        "incident_jump_minutes": 0,
        "situation_update": "Séptimo mes de un contrato remoto. Se acumulan pequeñas anomalías.",
        "key_questions": [
          "¿Confrontar, vigilar en silencio o cortar el acceso ya?"
        ],
        "objectives": [
          {
            "code": "OBJ-01",
            "due": true
          },
          {
            "code": "OBJ-02",
            "due": false
          }
        ],
        "headline": "Pequeñas anomalías alrededor de un contratista remoto"
      },
      {
        "code": "PH-02",
        "name": "Tras la rescisión",
        "start_offset": 50,
        "end_offset": 110,
        "incident_jump_minutes": 2880,
        "situation_update": "Dos días después. Se ha rescindido el contrato; empieza la investigación.",
        "key_questions": [
          "¿Hasta dónde miramos atrás y qué rotamos?"
        ],
        "objectives": [
          {
            "code": "OBJ-02",
            "due": true
          },
          {
            "code": "OBJ-03",
            "due": false
          }
        ],
        "headline": "¿Qué se llevó antes de irse?"
      },
      {
        "code": "PH-03",
        "name": "La exigencia",
        "start_offset": 110,
        "end_offset": 170,
        "incident_jump_minutes": 7200,
        "situation_update": "Una semana después. Un correo anónimo adjunta muestras del código fuente.",
        "key_questions": [
          "¿Pagar es siquiera legal?"
        ],
        "objectives": [
          {
            "code": "OBJ-03",
            "due": true
          }
        ],
        "headline": "Pagar o el código se publica"
      }
    ],
    "threat_actors": [
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "THR-01",
        "name": "Esquema de trabajadores TI respaldado por un Estado",
        "mitre_group_id": null,
        "aliases": [],
        "description": "Trabajadores colocados con identidades falsas por un Estado sancionado para obtener ingresos y, cuando conviene, robar datos.",
        "techniques": [
          {
            "domain": "enterprise",
            "technique_id": "T1585.001"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1219"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1213.003"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1567.002"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1657"
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
        "title": "Una herramienta de acceso remoto en el portátil de un contratista",
        "content": "El SOC señala el portátil de un desarrollador remoto: una VPN comercial y una herramienta de acceso remoto que no está aprobada, e inicios de sesión desde dos regiones a seis horas de distancia en la misma hora.",
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
          "CISO"
        ],
        "delivery_method": "security_tool",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0011",
            "technique_id": "T1219"
          }
        ],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-01"
        ],
        "expected_actions": [
          {
            "code": "INJ-01-A1",
            "description": "Escala al CISO y abre un caso confidencial.",
            "responsible_role": "Responsable de operaciones de seguridad",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-01"
            ]
          }
        ],
        "images": [],
        "room_codes": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-02",
        "phase_code": "PH-01",
        "kind": "mandatory",
        "title": "Nóminas detecta una cuenta bancaria nueva",
        "content": "Nóminas comenta de pasada que el mismo contratista cambió su cuenta bancaria a una plataforma de pagos en línea, y que la agencia no consiguió hablar con él por teléfono la semana pasada.",
        "offset_minutes": 25,
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
          "Recursos Humanos",
          "Operaciones de seguridad"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-01",
          "OBJ-02"
        ],
        "expected_actions": [
          {
            "code": "INJ-02-A1",
            "description": "Recursos Humanos lo comparte con seguridad y acuerdan no alertar aún al contratista.",
            "responsible_role": "Responsable de Recursos Humanos",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-01"
            ]
          },
          {
            "code": "INJ-02-A2",
            "description": "Legal confirma qué vigilancia es legal y quién lidera.",
            "responsible_role": "Legal",
            "expected_within_minutes": 20,
            "objective_codes": [
              "OBJ-02"
            ]
          }
        ],
        "images": [],
        "room_codes": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-03",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "Repositorios clonados y claves descargadas",
        "content": "El proveedor de respuesta a incidentes: en las tres semanas anteriores a la rescisión, la cuenta clonó 40 repositorios de golpe y descargó claves de acceso cloud del almacén compartido.",
        "offset_minutes": 55,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-03",
        "attack_attribution": "threat_actor",
        "threat_actor_code": "THR-01",
        "recipients": [
          "CISO",
          "TI",
          "Legal"
        ],
        "delivery_method": "briefing",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0009",
            "technique_id": "T1213.003"
          },
          {
            "domain": "enterprise",
            "tactic_id": "TA0010",
            "technique_id": "T1567.002"
          }
        ],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-02"
        ],
        "expected_actions": [
          {
            "code": "INJ-03-A1",
            "description": "Rota todos los secretos y claves a los que tenía acceso la cuenta.",
            "responsible_role": "Director de TI",
            "expected_within_minutes": 30,
            "objective_codes": [
              "OBJ-02"
            ]
          },
          {
            "code": "INJ-03-A2",
            "description": "Conserva el portátil y los registros como prueba.",
            "responsible_role": "Legal",
            "expected_within_minutes": 20,
            "objective_codes": [
              "OBJ-02"
            ]
          }
        ],
        "images": [],
        "room_codes": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-04",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "El perfil encaja con un esquema sancionado",
        "content": "El proveedor de inteligencia de amenazas: el perfil, la configuración del portátil y la plataforma de pagos encajan con un esquema conocido de trabajadores TI respaldados por un Estado. Meses de pagos pueden haber llegado a una entidad sancionada.",
        "offset_minutes": 85,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-04",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Legal",
          "Comité de crisis"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-03"
        ],
        "expected_actions": [
          {
            "code": "INJ-04-A1",
            "description": "Evalúa la exposición a sanciones y si hay que comunicarlo.",
            "responsible_role": "Legal",
            "expected_within_minutes": 30,
            "objective_codes": [
              "OBJ-03"
            ]
          }
        ],
        "images": [],
        "room_codes": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-05",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "Pagar o se publica el código",
        "content": "Un correo anónimo al director de tecnología adjunta tres ficheros de vuestro código fuente y pide un pago en criptomoneda en cinco días; si no, se publicarán los repositorios.",
        "offset_minutes": 115,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-05",
        "attack_attribution": "threat_actor",
        "threat_actor_code": "THR-01",
        "recipients": [
          "Comité de crisis",
          "Legal"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0040",
            "technique_id": "T1657"
          }
        ],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-03"
        ],
        "expected_actions": [
          {
            "code": "INJ-05-A1",
            "description": "Decide sobre la exigencia y denuncia ante la policía.",
            "responsible_role": "Comité de crisis",
            "expected_within_minutes": 20,
            "objective_codes": [
              "OBJ-03"
            ]
          }
        ],
        "images": [],
        "room_codes": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-06",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "Un cliente pregunta si su código quedó expuesto",
        "content": "Un cliente en cuya integración trabajó el contratista ha oído rumores y pregunta si su código o sus datos estuvieron accesibles.",
        "offset_minutes": 140,
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
          "Responsable de comunicación",
          "Legal"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-03"
        ],
        "expected_actions": [
          {
            "code": "INJ-06-A1",
            "description": "Acuerda qué decir a los clientes afectados.",
            "responsible_role": "Responsable de comunicación",
            "expected_within_minutes": 20,
            "objective_codes": [
              "OBJ-03"
            ]
          }
        ],
        "images": [],
        "room_codes": []
      }
    ],
    "next_phase_number": 4,
    "next_inject_number": 7,
    "next_threat_actor_number": 2
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
      "origin_id": "insider",
      "origin_name": "Empleado",
      "code": "ACT-02",
      "name": "Empleado",
      "type": "internal",
      "description": "Un empleado que avisa de algo extraño, o el insider que está detrás.",
      "channel": "in_person"
    },
    {
      "origin": "system",
      "origin_id": "dfir-provider",
      "origin_name": "Proveedor de respuesta a incidentes (retainer)",
      "code": "ACT-03",
      "name": "Proveedor de respuesta a incidentes (retainer)",
      "type": "supplier",
      "description": "El equipo externo de respuesta y forense, normalmente con un contrato (retainer) que se activa durante el incidente: hallazgos, informes y recomendaciones de contención.",
      "channel": "briefing"
    },
    {
      "origin": "system",
      "origin_id": "threat-intel-provider",
      "origin_name": "Proveedor de inteligencia de amenazas",
      "code": "ACT-04",
      "name": "Proveedor de inteligencia de amenazas",
      "type": "supplier",
      "description": "Vigila foros, sitios de filtraciones y redes: avisa de datos expuestos y de la actividad del atacante.",
      "channel": "email"
    },
    {
      "origin": "system",
      "origin_id": "threat-actor",
      "origin_name": "Atacante (remitente)",
      "code": "ACT-05",
      "name": "Atacante (remitente)",
      "type": "threat_actor",
      "description": "Firma los mensajes del atacante: notas de rescate, publicaciones de filtraciones, plazos. Quién es el atacante, y sus técnicas, son los actores de amenaza del escenario.",
      "channel": "document"
    },
    {
      "origin": "system",
      "origin_id": "customer",
      "origin_name": "Cliente",
      "code": "ACT-06",
      "name": "Cliente",
      "type": "customer",
      "description": "Un cliente que nota el impacto y pide explicaciones.",
      "channel": "email"
    }
  ],
  "next_actor_number": 7,
  "tags": [
    {
      "origin": "system",
      "origin_id": "insider",
      "origin_name": "Amenaza interna",
      "name": "Amenaza interna",
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
      "origin_id": "crisis-committee",
      "origin_name": "Comité de crisis",
      "name": "Comité de crisis",
      "color": "indigo",
      "custom_hex": null,
      "applied": true
    }
  ],
  "images": [],
  "uses_rooms": false,
  "rooms": [],
  "next_room_number": 1
}
```
