---
format: "ttx-zone.scenario"
format_version: 3
language: "es"
title: "Extorsión tras un día cero en la transferencia de ficheros"
exported_at: "2026-10-31T00:00:00+00:00"
generator: "ttx-zone"
attack_version: "19.2"
---

# Extorsión tras un día cero en la transferencia de ficheros

Un grupo de extorsión explota un día cero en la plataforma de transferencia de ficheros que {organization} usa con sus socios y copia ficheros sin que nadie lo note. Semanas después, la dirección recibe un correo de extorsión con la lista de ficheros robados. No se cifra nada: la crisis gira en torno al alcance, las obligaciones de notificación y si pagar para no aparecer en el sitio de filtraciones.

> Escenario de TTX-Zone. Impórtalo desde Biblioteca → Escenarios. La parte legible se genera al exportar; solo se importa el bloque de datos del final.

## Objetivos

- **OBJ-01** Exposición evaluada rápido
- **OBJ-02** Plazo de notificación gestionado
- **OBJ-03** Decisión sobre la extorsión

## Escenario

El fabricante de la plataforma de transferencia de ficheros publica un aviso urgente: una vulnerabilidad se está explotando en todo el mundo. {organization} parchea, pero los registros del servidor solo cubren siete días. Tres semanas después llega el correo de extorsión.

## Fases e injects

### PH-01 El día del aviso

Martes, 09:00. El fabricante de la plataforma de transferencia publica un aviso urgente.

- **INJ-01** (T+5′) Aviso urgente del fabricante
- **INJ-02** (T+25′) Una web shell y solo siete días de registros

### PH-02 El correo de extorsión

Tres semanas después. La dirección recibe un correo con la lista de ficheros sacados de la plataforma.

- **INJ-03** (T+55′) «Tenemos vuestros ficheros»
- **INJ-04** (T+80′) Los datos de un socio estaban en los ficheros
- **INJ-05** (T+95′) La autoridad de protección de datos pregunta

### PH-03 El plazo

Cinco días después. El sitio de filtraciones incluye a {organization} entre las víctimas de la campaña.

- **INJ-06** (T+115′) Un periodista ve nuestro nombre en la lista
- **INJ-07** (T+140′) Una oferta para retirar el nombre

## Actores simulados

- **ACT-01** Proveedor crítico
- **ACT-02** SOC
- **ACT-03** Atacante (remitente)
- **ACT-04** Cliente
- **ACT-05** Autoridad de protección de datos
- **ACT-06** Medios de comunicación

```json ttx-zone-scenario
{
  "format": "ttx-zone.scenario",
  "format_version": 3,
  "language": "es",
  "exported_at": "2026-10-31T00:00:00Z",
  "exercise": {
    "name": "Extorsión tras un día cero en la transferencia de ficheros",
    "description": "Un grupo de extorsión explota un día cero en la plataforma de transferencia de ficheros que {organization} usa con sus socios y copia ficheros sin que nadie lo note. Semanas después, la dirección recibe un correo de extorsión con la lista de ficheros robados. No se cifra nada: la crisis gira en torno al alcance, las obligaciones de notificación y si pagar para no aparecer en el sitio de filtraciones."
  },
  "needs": {
    "tlp": "amber",
    "triggers": [
      "new_threat",
      "regulatory"
    ],
    "trigger_other": "",
    "regulatory_frameworks": [
      "GDPR"
    ],
    "regulatory_framework_other": "",
    "capabilities": [
      "crisis_decision_making",
      "detection_triage_escalation",
      "regulatory_notification"
    ],
    "levels": [
      "strategic",
      "tactical"
    ],
    "participating_areas": [
      "Comité de crisis",
      "Operaciones de seguridad",
      "TI",
      "Legal",
      "Protección de datos",
      "Comunicación",
      "Director de TI",
      "Delegado de protección de datos",
      "Responsable de operaciones de seguridad",
      "Presidencia del comité de crisis",
      "Responsable de comunicación"
    ],
    "third_parties": [
      "Fabricante de la plataforma de transferencia",
      "Socios logísticos"
    ],
    "perimeter": "La plataforma de transferencia, los datos intercambiados con socios, el comité de crisis y los equipos legal, de protección de datos y de comunicación.",
    "out_of_scope": "La negociación con los atacantes.",
    "max_duration_hours": 3,
    "confidentiality_restrictions": "",
    "budget_and_external_support": "",
    "stop_exercise_keyword": "QUIET LEDGER",
    "needs": [
      {
        "code": "NEED-01",
        "source": "threat_intel",
        "title": "Plataforma expuesta fuera del parcheo y la monitorización",
        "finding": "El servidor de transferencia lo gestiona el negocio, no TI; sus registros no se recogen de forma centralizada.",
        "affected_capability": "detection_triage_escalation",
        "priority": "high"
      },
      {
        "code": "NEED-02",
        "source": "regulatory",
        "title": "Sin un inicio claro del plazo de 72 horas",
        "finding": "Nadie ha acordado cuándo una brecha sospechada pasa a ser «conocida» a efectos de notificación.",
        "affected_capability": "regulatory_notification",
        "priority": "high"
      },
      {
        "code": "NEED-03",
        "source": "risk_analysis",
        "title": "Sin postura sobre pagar para evitar la publicación",
        "finding": "La dirección nunca ha hablado de una extorsión sin cifrado.",
        "affected_capability": "crisis_decision_making",
        "priority": "medium"
      }
    ],
    "objectives": [
      {
        "code": "OBJ-01",
        "title": "Exposición evaluada rápido",
        "statement": "Ante el aviso del fabricante, el equipo decide en menos de 60 minutos si desconecta la plataforma e inicia una evaluación de compromiso.",
        "capability": "detection_triage_escalation",
        "need_codes": [
          "NEED-01"
        ],
        "success_criterion": "Decisión de desconexión registrada\nEvaluación de compromiso iniciada",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Registro de decisiones y de la evaluación.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-02",
        "title": "Plazo de notificación gestionado",
        "statement": "El equipo determina cuándo se conoció la brecha, a qué autoridades, socios e interesados hay que informar, y documenta la decisión.",
        "capability": "regulatory_notification",
        "need_codes": [
          "NEED-02"
        ],
        "success_criterion": "Momento de conocimiento registrado\nDecisión de notificación documentada",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Registro de la brecha y borradores de notificación.",
        "regulatory_requirement_ids": [
          "GDPR-33-34"
        ]
      },
      {
        "code": "OBJ-03",
        "title": "Decisión sobre la extorsión",
        "statement": "El comité decide sobre la exigencia con el criterio de Legal y de la aseguradora, y acuerda una línea de comunicación.",
        "capability": "crisis_decision_making",
        "need_codes": [
          "NEED-03"
        ],
        "success_criterion": "Decisión y motivos registrados\nComunicado aprobado",
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
    "title": "Los ficheros que compartimos",
    "summary": "El fabricante de la plataforma de transferencia de ficheros publica un aviso urgente: una vulnerabilidad se está explotando en todo el mundo. {organization} parchea, pero los registros del servidor solo cubren siete días. Tres semanas después llega el correo de extorsión.",
    "attack_version": "19.2",
    "duration_minutes": 170,
    "time_compression": 60,
    "phases": [
      {
        "code": "PH-01",
        "name": "El día del aviso",
        "start_offset": 0,
        "end_offset": 50,
        "incident_jump_minutes": 0,
        "situation_update": "Martes, 09:00. El fabricante de la plataforma de transferencia publica un aviso urgente.",
        "key_questions": [
          "¿Dejamos de intercambiar ficheros con nuestros socios?"
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
        "headline": "Un día cero en nuestra plataforma de transferencia"
      },
      {
        "code": "PH-02",
        "name": "El correo de extorsión",
        "start_offset": 50,
        "end_offset": 110,
        "incident_jump_minutes": 30240,
        "situation_update": "Tres semanas después. La dirección recibe un correo con la lista de ficheros sacados de la plataforma.",
        "key_questions": [
          "¿Cuándo empezó a correr el plazo de notificación?"
        ],
        "objectives": [
          {
            "code": "OBJ-02",
            "due": false
          },
          {
            "code": "OBJ-03",
            "due": false
          }
        ],
        "headline": "Tres semanas después: «tenemos vuestros ficheros»"
      },
      {
        "code": "PH-03",
        "name": "El plazo",
        "start_offset": 110,
        "end_offset": 170,
        "incident_jump_minutes": 7200,
        "situation_update": "Cinco días después. El sitio de filtraciones incluye a {organization} entre las víctimas de la campaña.",
        "key_questions": [
          "¿Pagar para que nos retiren o aceptar la publicación?"
        ],
        "objectives": [
          {
            "code": "OBJ-02",
            "due": true
          },
          {
            "code": "OBJ-03",
            "due": true
          }
        ],
        "headline": "Nuestro nombre aparece en el sitio de filtraciones"
      }
    ],
    "threat_actors": [
      {
        "origin": "system",
        "origin_id": "G0092",
        "origin_name": "TA505",
        "code": "THR-01",
        "name": "TA505",
        "mitre_group_id": "G0092",
        "aliases": [],
        "description": "Grupo con motivación económica que lanza campañas de explotación masiva contra productos de transferencia de ficheros, seguidas de extorsión por correo.",
        "techniques": [
          {
            "domain": "enterprise",
            "technique_id": "T1190"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1505.003"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1041"
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
        "title": "Aviso urgente del fabricante",
        "content": "El fabricante de {product}: una vulnerabilidad crítica se está explotando activamente en todo el mundo. Aplicad el parche de emergencia o cortad el acceso desde internet, y buscad cuentas desconocidas y web shells.",
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
          "TI",
          "Operaciones de seguridad"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0001",
            "technique_id": "T1190"
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
            "description": "Localiza todas las instancias expuestas y decide si las desconecta.",
            "responsible_role": "Director de TI",
            "expected_within_minutes": 20,
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
        "title": "Una web shell y solo siete días de registros",
        "content": "El SOC encuentra una web shell y una cuenta de administrador que nadie ha creado en el servidor de transferencia. El servidor guarda registros de siete días; la actividad anterior no se puede reconstruir.",
        "offset_minutes": 25,
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
          "Operaciones de seguridad",
          "Delegado de protección de datos"
        ],
        "delivery_method": "security_tool",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0003",
            "technique_id": "T1505.003"
          }
        ],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-01",
          "OBJ-02"
        ],
        "expected_actions": [
          {
            "code": "INJ-02-A1",
            "description": "Inicia una evaluación de compromiso y conserva el servidor.",
            "responsible_role": "Responsable de operaciones de seguridad",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-01"
            ]
          },
          {
            "code": "INJ-02-A2",
            "description": "Abre un registro de brecha e inicia la evaluación de notificación.",
            "responsible_role": "Delegado de protección de datos",
            "expected_within_minutes": 30,
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
        "title": "«Tenemos vuestros ficheros»",
        "content": "La dirección recibe el mismo correo: el grupo ha «descargado vuestros ficheros del servidor de transferencia», adjunta una lista de 1.800 nombres de fichero y un enlace a un portal de negociación. Si nadie contacta en 7 días, se publicarán.",
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
          "OBJ-02",
          "OBJ-03"
        ],
        "expected_actions": [
          {
            "code": "INJ-03-A1",
            "description": "Contrasta la lista con los ficheros que había en el servidor.",
            "responsible_role": "Responsable de operaciones de seguridad",
            "expected_within_minutes": 20,
            "objective_codes": [
              "OBJ-02"
            ]
          },
          {
            "code": "INJ-03-A2",
            "description": "Convoca el comité de crisis e implica a la asesoría legal y a la aseguradora.",
            "responsible_role": "Presidencia del comité de crisis",
            "expected_within_minutes": 15,
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
        "code": "INJ-04",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "Los datos de un socio estaban en los ficheros",
        "content": "Un socio logístico ha leído sobre la campaña: sus albaranes con nombres y direcciones de clientes pasaron por vuestra plataforma. Pregunta si se los llevaron y qué vais a decir a los afectados.",
        "offset_minutes": 80,
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
          "Delegado de protección de datos",
          "Legal"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-02"
        ],
        "expected_actions": [
          {
            "code": "INJ-04-A1",
            "description": "Decide a quién hay que informar (autoridad, socios, interesados) y redacta los avisos.",
            "responsible_role": "Delegado de protección de datos",
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
        "origin": "system",
        "origin_id": "INJ-REG-04",
        "origin_name": "La autoridad de protección de datos pregunta",
        "code": "INJ-05",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "La autoridad de protección de datos pregunta",
        "content": "La autoridad de protección de datos ha visto a {organization} citada en informaciones sobre la campaña y pregunta si ha habido una brecha de datos personales y por qué no se ha notificado.",
        "offset_minutes": 95,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
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
        "scored": true,
        "objective_codes": [
          "OBJ-02"
        ],
        "expected_actions": [
          {
            "code": "INJ-05-A1",
            "description": "Responde con la notificación y la cronología de cuándo se conoció la brecha.",
            "responsible_role": "Delegado de protección de datos",
            "expected_within_minutes": 15,
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
        "code": "INJ-06",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "Un periodista ve nuestro nombre en la lista",
        "content": "Llama un periodista que cubre la campaña: {organization} aparece en la lista de víctimas del sitio de filtraciones. ¿Habéis pagado? ¿Hay datos de clientes?",
        "offset_minutes": 115,
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
          "Comité de crisis"
        ],
        "delivery_method": "phone",
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
            "description": "Aprueba el comunicado público.",
            "responsible_role": "Responsable de comunicación",
            "expected_within_minutes": 15,
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
        "code": "INJ-07",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "Una oferta para retirar el nombre",
        "content": "Un segundo correo: a cambio de un pago en criptomoneda, el grupo retirará a {organization} de la lista y «borrará» los ficheros. La oferta caduca en 48 horas.",
        "offset_minutes": 140,
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
            "code": "INJ-07-A1",
            "description": "Decide sobre la exigencia y deja constancia de los motivos.",
            "responsible_role": "Comité de crisis",
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
    "next_inject_number": 8,
    "next_threat_actor_number": 2
  },
  "cast": [
    {
      "origin": "system",
      "origin_id": "critical-supplier",
      "origin_name": "Proveedor crítico",
      "code": "ACT-01",
      "name": "Proveedor crítico",
      "type": "supplier",
      "description": "Un proveedor del que depende el negocio, afectado o implicado en el incidente.",
      "channel": "phone"
    },
    {
      "origin": "system",
      "origin_id": "soc",
      "origin_name": "SOC",
      "code": "ACT-02",
      "name": "SOC",
      "type": "soc",
      "description": "El centro de operaciones de seguridad: alertas, hallazgos y peticiones de decisión.",
      "channel": "ticket"
    },
    {
      "origin": "system",
      "origin_id": "threat-actor",
      "origin_name": "Atacante (remitente)",
      "code": "ACT-03",
      "name": "Atacante (remitente)",
      "type": "threat_actor",
      "description": "Firma los mensajes del atacante: notas de rescate, publicaciones de filtraciones, plazos. Quién es el atacante, y sus técnicas, son los actores de amenaza del escenario.",
      "channel": "document"
    },
    {
      "origin": "system",
      "origin_id": "customer",
      "origin_name": "Cliente",
      "code": "ACT-04",
      "name": "Cliente",
      "type": "customer",
      "description": "Un cliente que nota el impacto y pide explicaciones.",
      "channel": "email"
    },
    {
      "origin": "system",
      "origin_id": "data-protection-authority",
      "origin_name": "Autoridad de protección de datos",
      "code": "ACT-05",
      "name": "Autoridad de protección de datos",
      "type": "authority",
      "description": "La autoridad de control ante brechas de datos personales.",
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
    }
  ],
  "next_actor_number": 7,
  "tags": [
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
      "origin_id": "supply-chain",
      "origin_name": "Cadena de suministro",
      "name": "Cadena de suministro",
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
    },
    {
      "origin": "system",
      "origin_id": "gdpr",
      "origin_name": "RGPD",
      "name": "RGPD",
      "color": "slate",
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
