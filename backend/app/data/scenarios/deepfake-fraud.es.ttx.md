---
format: "ttx-zone.scenario"
format_version: 3
language: "es"
title: "El director financiero falso y las transferencias urgentes"
exported_at: "2026-10-31T00:00:00+00:00"
generator: "ttx-zone"
attack_version: "19.2"
---

# El director financiero falso y las transferencias urgentes

Unos atacantes clonan la cara y la voz del director financiero y, en una videollamada con varios «compañeros», convencen a una responsable financiera regional para hacer transferencias urgentes y confidenciales. El ejercicio pone a prueba la verificación de pagos, la respuesta cuando se descubre el fraude y si además es un incidente de ciberseguridad.

> Escenario de TTX-Zone. Impórtalo desde Biblioteca → Escenarios. La parte legible se genera al exportar; solo se importa el bloque de datos del final.

## Objetivos

- **OBJ-01** Verificación por otro canal
- **OBJ-02** Intento rápido de recuperación
- **OBJ-03** Alcance y obligaciones aclarados

## Escenario

Una responsable financiera regional de {organization} recibe un correo del director financiero sobre una adquisición confidencial que exige pagos urgentes. Sospecha que es phishing, hasta que entra en una videollamada donde el director financiero y dos compañeros lo confirman.

## Fases e injects

### PH-01 La petición

Jueves, 10:15. Una responsable financiera regional recibe un correo del director financiero.

- **INJ-01** (T+5′) Una petición confidencial del director financiero
- **INJ-02** (T+25′) Correos que suplantan a la alta dirección

### PH-02 La llamada

12:30. La videollamada lo confirma todo; las primeras transferencias están listas.

- **INJ-03** (T+55′) El director financiero en cámara
- **INJ-04** (T+80′) El banco ve un patrón extraño

### PH-03 El descubrimiento

Cinco días después. En la sede nadie sabe nada de la operación.

- **INJ-05** (T+105′) Nadie sabe nada de la operación
- **INJ-06** (T+130′) ¿Se comprometió algo?
- **INJ-07** (T+150′) El consejo quiere saber qué decir

## Actores simulados

- **ACT-01** Atacante (remitente)
- **ACT-02** CSIRT nacional
- **ACT-03** Banco de la organización
- **ACT-04** Empleado
- **ACT-05** Proveedor de respuesta a incidentes (retainer)
- **ACT-06** Presidencia del consejo

```json ttx-zone-scenario
{
  "format": "ttx-zone.scenario",
  "format_version": 3,
  "language": "es",
  "exported_at": "2026-10-31T00:00:00Z",
  "exercise": {
    "name": "El director financiero falso y las transferencias urgentes",
    "description": "Unos atacantes clonan la cara y la voz del director financiero y, en una videollamada con varios «compañeros», convencen a una responsable financiera regional para hacer transferencias urgentes y confidenciales. El ejercicio pone a prueba la verificación de pagos, la respuesta cuando se descubre el fraude y si además es un incidente de ciberseguridad."
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
      "Finanzas",
      "Tesorería",
      "Legal",
      "Operaciones de seguridad",
      "Comunicación",
      "Responsable financiera regional",
      "Dirección financiera",
      "Presidencia del comité de crisis",
      "CISO",
      "Consejero delegado"
    ],
    "third_parties": [
      "Banco"
    ],
    "perimeter": "El proceso de pagos, los equipos financieros, el comité de crisis, Legal y seguridad.",
    "out_of_scope": "El análisis técnico del deepfake.",
    "max_duration_hours": 3,
    "confidentiality_restrictions": "",
    "budget_and_external_support": "",
    "stop_exercise_keyword": "PAPER MOON",
    "needs": [
      {
        "code": "NEED-01",
        "source": "threat_intel",
        "title": "Los controles de pago se basan en reconocer al directivo",
        "finding": "Los pagos urgentes se aprueban cuando los pide un directivo conocido; no hay verificación por otro canal.",
        "affected_capability": "detection_triage_escalation",
        "priority": "high"
      },
      {
        "code": "NEED-02",
        "source": "incident_history",
        "title": "Reacción lenta ante pagos fraudulentos",
        "finding": "En un fraude anterior, se pidió al banco recuperar el dinero un día después de descubrirlo.",
        "affected_capability": "crisis_decision_making",
        "priority": "high"
      },
      {
        "code": "NEED-03",
        "source": "risk_analysis",
        "title": "Fraude e incidentes de ciberseguridad por separado",
        "finding": "No hay una forma acordada de decidir si un fraude es también un incidente de ciberseguridad con obligación de notificar.",
        "affected_capability": "legal_forensics",
        "priority": "medium"
      }
    ],
    "objectives": [
      {
        "code": "OBJ-01",
        "title": "Verificación por otro canal",
        "statement": "Finanzas verifica por un canal conocido cualquier petición de pago urgente y confidencial antes de pagar.",
        "capability": "detection_triage_escalation",
        "need_codes": [
          "NEED-01"
        ],
        "success_criterion": "Petición verificada por un canal conocido\nTransferencias grandes y urgentes retenidas para una segunda aprobación",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Registro de pagos y de la verificación.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-02",
        "title": "Intento rápido de recuperación",
        "statement": "En menos de 30 minutos desde el descubrimiento el equipo congela, solicita la devolución y denuncia en un orden fijado, con un responsable.",
        "capability": "crisis_decision_making",
        "need_codes": [
          "NEED-02"
        ],
        "success_criterion": "Devolución solicitada\nDenuncia presentada\nResponsable nombrado",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Correspondencia con el banco y cronología de decisiones.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-03",
        "title": "Alcance y obligaciones aclarados",
        "statement": "El equipo determina si se comprometió algún sistema y qué notificaciones, reclamaciones al seguro y mensajes corresponden.",
        "capability": "legal_forensics",
        "need_codes": [
          "NEED-03"
        ],
        "success_criterion": "Decisión sobre el incidente registrada\nAseguradora notificada",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Valoración legal y actas del comité.",
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
    "title": "Ver para creer",
    "summary": "Una responsable financiera regional de {organization} recibe un correo del director financiero sobre una adquisición confidencial que exige pagos urgentes. Sospecha que es phishing, hasta que entra en una videollamada donde el director financiero y dos compañeros lo confirman.",
    "attack_version": "19.2",
    "duration_minutes": 160,
    "time_compression": 60,
    "phases": [
      {
        "code": "PH-01",
        "name": "La petición",
        "start_offset": 0,
        "end_offset": 50,
        "incident_jump_minutes": 0,
        "situation_update": "Jueves, 10:15. Una responsable financiera regional recibe un correo del director financiero.",
        "key_questions": [
          "¿A quién llamaría para comprobarlo, y cómo?"
        ],
        "objectives": [
          {
            "code": "OBJ-01",
            "due": false
          }
        ],
        "headline": "Una operación confidencial exige pagos urgentes"
      },
      {
        "code": "PH-02",
        "name": "La llamada",
        "start_offset": 50,
        "end_offset": 100,
        "incident_jump_minutes": 120,
        "situation_update": "12:30. La videollamada lo confirma todo; las primeras transferencias están listas.",
        "key_questions": [
          "¿Qué comprobación habría desenmascarado la llamada?"
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
        "headline": "El director financiero lo confirma en cámara"
      },
      {
        "code": "PH-03",
        "name": "El descubrimiento",
        "start_offset": 100,
        "end_offset": 160,
        "incident_jump_minutes": 7200,
        "situation_update": "Cinco días después. En la sede nadie sabe nada de la operación.",
        "key_questions": [
          "Congelar, recuperar, denunciar, avisar al seguro: ¿en qué orden?"
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
        "headline": "En la sede nadie sabe nada de la operación"
      }
    ],
    "threat_actors": [
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "THR-01",
        "name": "Grupo de fraude",
        "mitre_group_id": null,
        "aliases": [],
        "description": "Grupo de fraude sin identificar que clona la cara y la voz de directivos a partir de vídeos públicos.",
        "techniques": [
          {
            "domain": "enterprise",
            "technique_id": "T1593"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1683.002"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1684.001"
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
        "title": "Una petición confidencial del director financiero",
        "content": "«Necesito tu ayuda con una adquisición confidencial que anunciaremos la semana que viene. Legal te enviará los detalles. Hoy hay que hacer varios pagos; de momento, que quede entre nosotros». El remitente parece la dirección del director financiero, con una letra cambiada.",
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
          "Responsable financiera regional"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0005",
            "technique_id": "T1684.001"
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
            "description": "Comprueba la petición con el director financiero por un canal conocido.",
            "responsible_role": "Responsable financiera regional",
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
        "origin": "system",
        "origin_id": "INJ-BEC-02",
        "origin_name": "Correos que suplantan a la alta dirección",
        "code": "INJ-02",
        "phase_code": "PH-01",
        "kind": "mandatory",
        "title": "Correos que suplantan a la alta dirección",
        "content": "El CSIRT nacional avisa de una oleada de correos y videollamadas que suplantan a altos directivos para ordenar pagos urgentes, algunas con voces y caras clonadas.",
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
          "Dirección financiera",
          "Operaciones de seguridad"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-01"
        ],
        "expected_actions": [
          {
            "code": "INJ-02-A1",
            "description": "Avisa a los equipos financieros y recuerda la regla de verificación.",
            "responsible_role": "Dirección financiera",
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
        "code": "INJ-03",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "El director financiero en cámara",
        "content": "Se abre la videollamada: el director financiero y dos compañeros de la sede, con la cámara encendida. Le da las gracias, explica la operación y pide quince transferencias a cinco cuentas hoy mismo. La imagen se congela a ratos; «el wifi del hotel», dice.",
        "offset_minutes": 55,
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
          "Responsable financiera regional",
          "Tesorería"
        ],
        "delivery_method": "chat",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0042",
            "technique_id": "T1683.002"
          },
          {
            "domain": "enterprise",
            "tactic_id": "TA0005",
            "technique_id": "T1684.001"
          }
        ],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-01"
        ],
        "expected_actions": [
          {
            "code": "INJ-03-A1",
            "description": "Pregunta algo que solo sabría el director financiero real, o le devuelve la llamada a un número conocido.",
            "responsible_role": "Responsable financiera regional",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-01"
            ]
          },
          {
            "code": "INJ-03-A2",
            "description": "Retiene el lote de transferencias grandes y urgentes para una segunda aprobación.",
            "responsible_role": "Tesorería",
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
        "code": "INJ-04",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "El banco ve un patrón extraño",
        "content": "Llama el gestor del banco: hay varias transferencias grandes a beneficiarios nuevos en dos países en cola, algo poco habitual en esta oficina. «¿Las confirmáis?».",
        "offset_minutes": 80,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-03",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Tesorería"
        ],
        "delivery_method": "phone",
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
            "code": "INJ-04-A1",
            "description": "Detiene las transferencias pendientes y pide al banco recuperar las ya enviadas.",
            "responsible_role": "Tesorería",
            "expected_within_minutes": 10,
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
        "code": "INJ-05",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "Nadie sabe nada de la operación",
        "content": "La responsable regional menciona «la adquisición» a la sede. La oficina del director financiero nunca ha oído hablar de ella. Quince transferencias, cinco cuentas, decenas de millones en cinco días.",
        "offset_minutes": 105,
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
          "Comité de crisis",
          "Tesorería",
          "Legal"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-02",
          "OBJ-03"
        ],
        "expected_actions": [
          {
            "code": "INJ-05-A1",
            "description": "Nombra un responsable, pide al banco una devolución urgente y denuncia ante la policía.",
            "responsible_role": "Presidencia del comité de crisis",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-02"
            ]
          },
          {
            "code": "INJ-05-A2",
            "description": "Notifica a la aseguradora.",
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
        "code": "INJ-06",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "¿Se comprometió algo?",
        "content": "El proveedor de respuesta a incidentes informa: se registró un dominio parecido hace un mes y el buzón de un empleado tiene una regla de reenvío que nadie reconoce. De momento no hay malware.",
        "offset_minutes": 130,
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
          "CISO",
          "Legal"
        ],
        "delivery_method": "briefing",
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
            "description": "Decide si es un incidente de ciberseguridad notificable y deja constancia de por qué.",
            "responsible_role": "Legal",
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
        "code": "INJ-07",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "El consejo quiere saber qué decir",
        "content": "Llama la presidencia del consejo: los auditores han preguntado por «un fraude en pagos» y quiere saber qué se dirá a la plantilla, a los auditores y, si hace falta, al mercado.",
        "offset_minutes": 150,
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
          "Consejero delegado",
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
            "code": "INJ-07-A1",
            "description": "Acuerda qué decir a la plantilla, a los auditores y al consejo.",
            "responsible_role": "Consejero delegado",
            "expected_within_minutes": 15,
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
      "origin_id": "threat-actor",
      "origin_name": "Atacante (remitente)",
      "code": "ACT-01",
      "name": "Atacante (remitente)",
      "type": "threat_actor",
      "description": "Firma los mensajes del atacante: notas de rescate, publicaciones de filtraciones, plazos. Quién es el atacante, y sus técnicas, son los actores de amenaza del escenario.",
      "channel": "document"
    },
    {
      "origin": "system",
      "origin_id": "national-csirt",
      "origin_name": "CSIRT nacional",
      "code": "ACT-02",
      "name": "CSIRT nacional",
      "type": "csirt",
      "description": "El equipo nacional de respuesta a incidentes: pide notificaciones y comparte indicadores.",
      "channel": "email"
    },
    {
      "origin": "system",
      "origin_id": "bank",
      "origin_name": "Banco de la organización",
      "code": "ACT-03",
      "name": "Banco de la organización",
      "type": "other",
      "description": "La entidad bancaria: transferencias sospechosas, retención de fondos y plazos para recuperarlos.",
      "channel": "phone"
    },
    {
      "origin": "system",
      "origin_id": "insider",
      "origin_name": "Empleado",
      "code": "ACT-04",
      "name": "Empleado",
      "type": "internal",
      "description": "Un empleado que avisa de algo extraño, o el insider que está detrás.",
      "channel": "in_person"
    },
    {
      "origin": "system",
      "origin_id": "dfir-provider",
      "origin_name": "Proveedor de respuesta a incidentes (retainer)",
      "code": "ACT-05",
      "name": "Proveedor de respuesta a incidentes (retainer)",
      "type": "supplier",
      "description": "El equipo externo de respuesta y forense, normalmente con un contrato (retainer) que se activa durante el incidente: hallazgos, informes y recomendaciones de contención.",
      "channel": "briefing"
    },
    {
      "origin": "system",
      "origin_id": "board-chair",
      "origin_name": "Presidencia del consejo",
      "code": "ACT-06",
      "name": "Presidencia del consejo",
      "type": "internal",
      "description": "La presidencia del consejo de administración cuando el consejo no juega: pide explicaciones y convoca sesiones.",
      "channel": "phone"
    }
  ],
  "next_actor_number": 7,
  "tags": [
    {
      "origin": "system",
      "origin_id": "bec",
      "origin_name": "BEC / Fraude del CEO",
      "name": "BEC / Fraude del CEO",
      "color": "rose",
      "custom_hex": null,
      "applied": true
    },
    {
      "origin": "system",
      "origin_id": "executive",
      "origin_name": "Directivo",
      "name": "Directivo",
      "color": "indigo",
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
