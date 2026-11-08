---
format: "ttx-zone.scenario"
format_version: 8
language: "es"
title: "Dos incidentes, una campaña contra la planta"
exported_at: "2026-11-05T00:00:00+00:00"
generator: "ttx-zone"
attack_version: "19.2"
---

# Dos incidentes, una campaña contra la planta

Un fabricante de vehículos afronta dos incidentes en apariencia separados: un proveedor de mantenimiento comprometido con acceso remoto a una planta de montaje y un malware en un servidor de control de línea. Dos equipos los trabajan en salas distintas hasta que convergen en una sola campaña de sabotaje, coacción, extorsión y documentos falsos.

> Escenario de TTX-Zone. Impórtalo desde Biblioteca → Escenarios. La parte legible se genera al exportar; solo se importa el bloque de datos del final.

## Objetivos

- **OBJ-01** Decidir sobre el acceso del proveedor sin certezas
- **OBJ-02** Proteger personas y evidencias tras el daño
- **OBJ-03** Tratar la coacción como un asunto de seguridad
- **OBJ-04** Gobernar la decisión ante la extorsión
- **OBJ-05** Separar hechos y falsedades en público

## Escenario

{organization} fabrica vehículos en {assembly_plant} y opera sus sistemas de control de línea desde un centro de fabricación compartido. {supplier} mantiene en remoto robots y controladores. Ninguno de los dos equipos sabe aún que se enfrenta al mismo adversario.

## Fases e injects

### PH-01 Dos alarmas discretas

Día 1, por la mañana. Cada equipo está en su sala y no sabe lo que ve el otro.

- **INJ-01** (T+5′) El proveedor de mantenimiento comunica una brecha
- **INJ-02** (T+5′) Tráfico saliente de un servidor de control de línea
- **INJ-03** (T+22′) Sesiones remotas no planificadas en la planta
- **INJ-04** (contingente) Una cuenta genérica del proveedor entra de noche
- **INJ-05** (T+25′) Proceso desconocido con la cuenta de un contratista

### PH-02 Daño y coacción

Día 4. De madrugada, el turno de noche de la planta llama a la guardia.

- **INJ-06** (T+50′) Colisión de robots en la línea de montaje
- **INJ-07** (T+50′) Un directivo pide protección
- **INJ-08** (T+66′) Un fallo crítico en los controladores de línea
- **INJ-09** (T+68′) Malware con muchos módulos y datos confidenciales fuera
- **INJ-10** (T+82′) Firmware alterado: fue un ataque

### PH-03 Una sola campaña

Día 12. Los dos incidentes ya son uno. El Controlador reúne a todos en la sala principal.

- **INJ-11** (T+100′) Paga o enseñamos cómo lo hicimos
- **POL-12** (T+110′) La cuenta atrás
  - La cuenta atrás corre y el actor tiene datos auténticos. ¿Qué haces?
    - Rechazar todo contacto y prepararse para la publicación
      - Una línea clara que la policía y casi todas las aseguradoras valoran. Los datos salen cuando quiere el actor, y hace falta tener todo preparado.
    - Abrir un canal mediante especialistas para ganar tiempo, sin prometer el pago
      - Ganas horas y sabes qué tiene realmente el actor. Plantilla y reguladores pueden leerlo como negociar, y el canal debe gestionarse con todo rigor.
    - Pagar para detener la publicación
      - Puede retrasar la publicación, pero nada lo garantiza. Sanciones, seguro y consejo se vuelven un problema, y pasas a ser un objetivo que paga.
    - Hacerlo público antes de que lo haga el actor
      - Controlas la historia un día. Anuncias con datos incompletos, y cada corrección posterior contará en tu contra.
- **INJ-13** (T+118′) La policía convoca una reunión sectorial
- **INJ-14** (T+126′) Documentos auténticos y falsos, juntos
- **INJ-15** (T+134′) La historia corre por las redes
- **INJ-16** (T+142′) Las acciones caen

### PH-04 Cierre

Tres semanas después. La restauración está casi terminada.

- **DSC-17** (T+155′) Cerrar la crisis
- **DSC-18** (T+168′) Lecciones de dos salas

## Actores simulados

- **ACT-01** Proveedor crítico
- **ACT-02** SOC
- **ACT-03** Miembro del equipo de ciberseguridad
- **ACT-04** Proveedor de respuesta a incidentes (retainer)
- **ACT-05** CSIRT nacional
- **ACT-06** Unidad de delitos informáticos
- **ACT-07** Atacante (remitente)
- **ACT-08** Proveedor de inteligencia de amenazas
- **ACT-09** Medios de comunicación
- **ACT-10** Empleado
- **ACT-11** Presidencia del consejo

```json ttx-zone-scenario
{
  "format": "ttx-zone.scenario",
  "format_version": 8,
  "language": "es",
  "exported_at": "2026-11-05T00:00:00Z",
  "exercise": {
    "name": "Dos incidentes, una campaña contra la planta",
    "description": "Un fabricante de vehículos afronta dos incidentes en apariencia separados: un proveedor de mantenimiento comprometido con acceso remoto a una planta de montaje y un malware en un servidor de control de línea. Dos equipos los trabajan en salas distintas hasta que convergen en una sola campaña de sabotaje, coacción, extorsión y documentos falsos."
  },
  "needs": {
    "tlp": "amber",
    "triggers": [
      "new_threat",
      "org_or_tech_change"
    ],
    "trigger_other": "",
    "regulatory_frameworks": [
      "NIS2",
      "GDPR"
    ],
    "regulatory_framework_other": "",
    "capabilities": [
      "third_party_supply_chain",
      "cross_unit_coordination",
      "crisis_decision_making",
      "internal_external_comms"
    ],
    "levels": [
      "strategic",
      "tactical"
    ],
    "participating_areas": [
      "Responsable del incidente",
      "CISO",
      "Operaciones de seguridad",
      "Dirección de planta",
      "Seguridad OT",
      "Compras",
      "Sistemas de fabricación",
      "Recursos humanos",
      "Seguridad física",
      "Legal",
      "Delegado de protección de datos",
      "Comunicación",
      "Consejero delegado",
      "Comité de crisis",
      "Relación con inversores"
    ],
    "third_parties": [],
    "perimeter": "Acceso de proveedores, sistemas de planta y de control de línea, seguridad personal de la plantilla, gestión de la brecha de datos y comunicación de crisis.",
    "out_of_scope": "Llamadas a revisión de vehículos, ingeniería de producto y cualquier contacto real con autoridades o con el actor.",
    "max_duration_hours": 3,
    "confidentiality_restrictions": "",
    "budget_and_external_support": "",
    "stop_exercise_keyword": "PINZÓN DE HIERRO",
    "needs": [
      {
        "code": "NEED-01",
        "source": "regulatory",
        "title": "El acceso de proveedores no tiene interruptor",
        "finding": "Nadie ha ensayado cortar el acceso remoto de un proveedor crítico mientras la producción depende de él.",
        "affected_capability": "third_party_supply_chain",
        "priority": "high"
      },
      {
        "code": "NEED-02",
        "source": "regulatory",
        "title": "Planta, TI y personas trabajan por separado",
        "finding": "Los incidentes que afectan a la seguridad de planta o a un empleado amenazado no tienen una forma acordada de unir seguridad, operaciones, recursos humanos y seguridad física.",
        "affected_capability": "cross_unit_coordination",
        "priority": "high"
      },
      {
        "code": "NEED-03",
        "source": "regulatory",
        "title": "Extorsión y documentos falsos sin ensayar",
        "finding": "El comité de crisis nunca ha decidido cómo responder a una extorsión ni cómo demostrar qué documentos publicados son falsos.",
        "affected_capability": "crisis_decision_making",
        "priority": "medium"
      }
    ],
    "objectives": [
      {
        "code": "OBJ-01",
        "title": "Decidir sobre el acceso del proveedor sin certezas",
        "statement": "Antes de tener pruebas de impacto, el equipo averigua a qué llega el proveedor y decide quién mantiene acceso, sopesando producción y exposición.",
        "capability": "third_party_supply_chain",
        "need_codes": [
          "NEED-01"
        ],
        "success_criterion": "Cuentas y vías del proveedor enumeradas\nDecisión sobre el acceso registrada con su responsable\nContacto directo con la seguridad del proveedor",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "El inventario de accesos y la decisión.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-02",
        "title": "Proteger personas y evidencias tras el daño",
        "statement": "Tras el daño físico en la planta, operaciones y seguridad protegen la zona, conservan las evidencias y acuerdan cómo reanudar las líneas con seguridad.",
        "capability": "cross_unit_coordination",
        "need_codes": [
          "NEED-02"
        ],
        "success_criterion": "Personas a salvo y zona asegurada\nEvidencias de controladores y red conservadas\nCondiciones de rearranque acordadas",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "El registro de evidencias y las condiciones de rearranque.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-03",
        "title": "Tratar la coacción como un asunto de seguridad",
        "statement": "Se protege y escucha a un empleado amenazado, con policía e investigación coordinadas y sin tratarlo de entrada como sospechoso.",
        "capability": "cross_unit_coordination",
        "need_codes": [
          "NEED-02"
        ],
        "success_criterion": "Medidas de seguridad personal acordadas\nPolicía informada\nInvestigación confidencial y evidencias conservadas",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "El registro de la gestión.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-04",
        "title": "Gobernar la decisión ante la extorsión",
        "statement": "El comité de crisis decide quién responde a la extorsión, con Legal, seguro y policía, y cumple sus obligaciones de notificación.",
        "capability": "crisis_decision_making",
        "need_codes": [
          "NEED-03"
        ],
        "success_criterion": "Responsable de la decisión nombrado\nLegal, policía y seguro consultados\nNotificaciones al día",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "El acta del comité.",
        "regulatory_requirement_ids": [
          "NIS2-23"
        ]
      },
      {
        "code": "OBJ-05",
        "title": "Separar hechos y falsedades en público",
        "statement": "La organización separa documentos auténticos y falsos, notifica lo que debe y responde con hechos verificados y una sola voz.",
        "capability": "internal_external_comms",
        "need_codes": [
          "NEED-03"
        ],
        "success_criterion": "Método para verificar documentos acordado\nDecisión sobre la brecha registrada\nUn portavoz y mensajes coherentes",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "El registro de verificación y las declaraciones.",
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
        "risk": "Las dos salas se pierden de vista antes de converger.",
        "mitigation": "El Controlador reúne a todos en la sala principal al inicio de la tercera fase."
      },
      {
        "risk": "El inject de coacción incomoda a alguien de la mesa.",
        "mitigation": "El Facilitador lo avisa en la sesión informativa y se ciñe al procedimiento."
      }
    ],
    "next_need_number": 4,
    "next_objective_number": 6
  },
  "msel": {
    "title": "Planta conectada",
    "summary": "{organization} fabrica vehículos en {assembly_plant} y opera sus sistemas de control de línea desde un centro de fabricación compartido. {supplier} mantiene en remoto robots y controladores. Ninguno de los dos equipos sabe aún que se enfrenta al mismo adversario.",
    "attack_version": "19.2",
    "duration_minutes": 180,
    "time_compression": 10,
    "phases": [
      {
        "code": "PH-01",
        "name": "Dos alarmas discretas",
        "start_offset": 0,
        "end_offset": 45,
        "incident_jump_minutes": 0,
        "situation_update": "Día 1, por la mañana. Cada equipo está en su sala y no sabe lo que ve el otro.",
        "key_questions": [
          "¿A qué puede llegar hoy este proveedor?",
          "¿Podemos obtener evidencias de un servidor sin agente?"
        ],
        "objectives": [
          {
            "code": "OBJ-01",
            "due": true
          }
        ],
        "headline": "Un proveedor en apuros y tráfico que no debería existir"
      },
      {
        "code": "PH-02",
        "name": "Daño y coacción",
        "start_offset": 45,
        "end_offset": 95,
        "incident_jump_minutes": 2880,
        "situation_update": "Día 4. De madrugada, el turno de noche de la planta llama a la guardia.",
        "key_questions": [
          "¿Quién decide que una línea puede volver a arrancar?",
          "¿Es un incidente o son dos?"
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
        "headline": "Robots fuera de control y un directivo amenazado"
      },
      {
        "code": "PH-03",
        "name": "Una sola campaña",
        "start_offset": 95,
        "end_offset": 150,
        "incident_jump_minutes": 13000,
        "situation_update": "Día 12. Los dos incidentes ya son uno. El Controlador reúne a todos en la sala principal.",
        "key_questions": [
          "¿Quién decide sobre la extorsión?",
          "¿Cómo demostramos que un documento es falso?"
        ],
        "objectives": [
          {
            "code": "OBJ-04",
            "due": true
          },
          {
            "code": "OBJ-05",
            "due": true
          }
        ],
        "headline": "Extorsión, documentos falsos y caída en bolsa"
      },
      {
        "code": "PH-04",
        "name": "Cierre",
        "start_offset": 150,
        "end_offset": 180,
        "incident_jump_minutes": 30000,
        "situation_update": "Tres semanas después. La restauración está casi terminada.",
        "key_questions": [
          "¿Qué sigue abierto cuando el comité de crisis se disuelva?",
          "¿De quién son las lecciones aprendidas?"
        ],
        "objectives": [],
        "headline": "Salir del modo crisis sin perder de vista"
      }
    ],
    "threat_actors": [
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "THR-01",
        "name": "Grupo sin identificar",
        "mitre_group_id": null,
        "aliases": [],
        "description": "Grupo con muchos recursos que combina compromiso de proveedores, coacción a empleados, sabotaje de equipos de planta, extorsión y documentos falsificados.",
        "techniques": [
          {
            "domain": "enterprise",
            "technique_id": "T1199"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1133"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1078"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1041"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1657"
          },
          {
            "domain": "ics",
            "technique_id": "T0836"
          },
          {
            "domain": "ics",
            "technique_id": "T0880"
          },
          {
            "domain": "ics",
            "technique_id": "T0879"
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
        "title": "El proveedor de mantenimiento comunica una brecha",
        "content": "La noticia llega por un socio de una empresa conjunta, no por {supplier}: su red ha sido comprometida, al parecer con malware. {supplier} mantiene en remoto robots y controladores de {assembly_plant}. Nadie sabe aún si los clientes están afectados, y {supplier} no ha emitido ningún comunicado.",
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
          "Seguridad OT",
          "Compras"
        ],
        "delivery_method": "phone",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0001",
            "technique_id": "T1199"
          }
        ],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-01"
        ],
        "expected_actions": [
          {
            "code": "INJ-01-A1",
            "description": "Localiza los contratos y el contacto de seguridad del proveedor.",
            "responsible_role": "Compras",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-01"
            ]
          },
          {
            "code": "INJ-01-A2",
            "description": "Enumera las cuentas del proveedor, sus vías VPN y los activos a los que llegan.",
            "responsible_role": "Seguridad OT",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-01"
            ]
          },
          {
            "code": "INJ-01-A3",
            "description": "Decide si se suspende el acceso del proveedor antes de tener evidencia interna.",
            "responsible_role": "Dirección de planta",
            "expected_within_minutes": 20,
            "objective_codes": [
              "OBJ-01"
            ]
          }
        ],
        "images": [],
        "room_codes": [
          "RM-01"
        ],
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
        "code": "INJ-02",
        "phase_code": "PH-01",
        "kind": "mandatory",
        "title": "Tráfico saliente de un servidor de control de línea",
        "content": "El SIEM marca un volumen inusual de tráfico desde un servidor de control de línea hacia una dirección pública en {country_1}, con una reputación dudosa pero no concluyente. El servidor no tiene agente EDR, así que nadie puede ver en remoto qué se ejecuta, y está conectado a la red de producción que alimenta las plantas.",
        "offset_minutes": 5,
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
          "Sistemas de fabricación"
        ],
        "delivery_method": "ticket",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0010",
            "technique_id": "T1041"
          }
        ],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-02"
        ],
        "expected_actions": [
          {
            "code": "INJ-02-A1",
            "description": "Conserva registros de firewall, servidor y red antes de tocar el servidor.",
            "responsible_role": "Operaciones de seguridad",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-02"
            ]
          },
          {
            "code": "INJ-02-A2",
            "description": "Explica qué se para en producción si se aísla el servidor.",
            "responsible_role": "Sistemas de fabricación",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-02"
            ]
          }
        ],
        "images": [],
        "room_codes": [
          "RM-02"
        ],
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
        "code": "INJ-03",
        "phase_code": "PH-01",
        "kind": "mandatory",
        "title": "Sesiones remotas no planificadas en la planta",
        "content": "El análisis muestra varios cientos de usuarios del proveedor, un puñado de cuentas genéricas y algunas con VPN directa a la red que gestiona las líneas de montaje. La monitorización ve ahora sesiones remotas no planificadas en esa red. Podrían ser mantenimiento. {supplier} todavía no ha contestado.",
        "offset_minutes": 22,
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
          "Seguridad OT",
          "Dirección de planta"
        ],
        "delivery_method": "security_tool",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0001",
            "technique_id": "T1133"
          }
        ],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-01"
        ],
        "expected_actions": [
          {
            "code": "INJ-03-A1",
            "description": "Coteja cada sesión con el mantenimiento planificado y conserva los registros.",
            "responsible_role": "Seguridad OT",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-01"
            ]
          },
          {
            "code": "INJ-03-A2",
            "description": "Decide qué pasa con las cuentas genéricas y el túnel VPN.",
            "responsible_role": "Dirección de planta",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-01"
            ]
          }
        ],
        "images": [],
        "room_codes": [
          "RM-01"
        ],
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
        "phase_code": "PH-01",
        "kind": "contingent",
        "title": "Una cuenta genérica del proveedor entra de noche",
        "content": "Una cuenta genérica del proveedor acaba de entrar en la red de gestión de líneas a las 03:12, fuera de toda ventana de mantenimiento, y sigue conectada. ¿Quién puede cortarla ahora mismo?",
        "offset_minutes": null,
        "trigger_condition": "Acceso del proveedor abierto 15 minutos después de INJ-03.",
        "contingent_purpose": "Forzar la decisión sobre el acceso.",
        "fires_at_minute": 40,
        "branch_from_code": "INJ-03",
        "branch_action_code": "INJ-03-A2",
        "rejoin_code": "INJ-06",
        "sender_code": "ACT-03",
        "attack_attribution": "threat_actor",
        "threat_actor_code": "THR-01",
        "recipients": [
          "Seguridad OT",
          "Dirección de planta"
        ],
        "delivery_method": "security_tool",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0001",
            "technique_id": "T1133"
          }
        ],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-01"
        ],
        "expected_actions": [
          {
            "code": "INJ-04-A1",
            "description": "Autoriza cortar la sesión y registra quién lo decidió.",
            "responsible_role": "Dirección de planta",
            "expected_within_minutes": 5,
            "objective_codes": [
              "OBJ-01"
            ]
          }
        ],
        "images": [],
        "room_codes": [
          "RM-01"
        ],
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
        "code": "INJ-05",
        "phase_code": "PH-01",
        "kind": "mandatory",
        "title": "Proceso desconocido con la cuenta de un contratista",
        "content": "Sobre el terreno, el equipo encuentra en el servidor un proceso desconocido con los permisos de un administrador externo de una empresa contratista. Esa cuenta llega además a otros servidores. Recursos humanos y el gestor del contrato preguntan cómo deben dirigirse a esa persona.",
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
          "Sistemas de fabricación",
          "Recursos humanos"
        ],
        "delivery_method": "ticket",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0001",
            "technique_id": "T1078"
          }
        ],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-02",
          "OBJ-03"
        ],
        "expected_actions": [
          {
            "code": "INJ-05-A1",
            "description": "Restringe la cuenta conservando las evidencias y enumera a qué accedió.",
            "responsible_role": "Operaciones de seguridad",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-02"
            ]
          },
          {
            "code": "INJ-05-A2",
            "description": "Acuerda con Legal cómo se hace la entrevista al administrador.",
            "responsible_role": "Recursos humanos",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-03"
            ]
          }
        ],
        "images": [],
        "room_codes": [
          "RM-02"
        ],
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
        "code": "INJ-06",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "Colisión de robots en la línea de montaje",
        "content": "Varios robots de la línea de carrocería de {assembly_plant} han golpeado bastidores y equipos cercanos. Sus enclavamientos de seguridad debían detenerlos ante una posición y un par anormales, y no lo hicieron. No hay heridos. La causa podría ser una avería, una receta defectuosa u otra cosa, y un medio local ya tiene fotos.",
        "offset_minutes": 50,
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
          "Dirección de planta",
          "Seguridad OT"
        ],
        "delivery_method": "phone",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "ics",
            "tactic_id": "TA0105",
            "technique_id": "T0880"
          },
          {
            "domain": "ics",
            "tactic_id": "TA0105",
            "technique_id": "T0879"
          }
        ],
        "facilitator_notes": "Aún no confirmes un ciberataque. El equipo debería preguntarse si el proveedor y las sesiones no planificadas están relacionados.",
        "objective_codes": [
          "OBJ-02"
        ],
        "expected_actions": [
          {
            "code": "INJ-06-A1",
            "description": "Para las celdas afectadas y asegura la zona para las personas.",
            "responsible_role": "Dirección de planta",
            "expected_within_minutes": 8,
            "objective_codes": [
              "OBJ-02"
            ]
          },
          {
            "code": "INJ-06-A2",
            "description": "Conserva las evidencias de controladores, sistema de seguridad y red antes de reparar.",
            "responsible_role": "Seguridad OT",
            "expected_within_minutes": 12,
            "objective_codes": [
              "OBJ-02"
            ]
          },
          {
            "code": "INJ-06-A3",
            "description": "Fija las condiciones para rearrancar cada línea.",
            "responsible_role": "Dirección de planta",
            "expected_within_minutes": 20,
            "objective_codes": [
              "OBJ-02"
            ]
          }
        ],
        "images": [],
        "room_codes": [
          "RM-01"
        ],
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
        "code": "INJ-07",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "Un directivo pide protección",
        "content": "El contratista explica que instaló el software mediante una solicitud de cambio aprobada, abierta por un responsable interno de servidores. Esa persona acude ahora a Recursos Humanos y pide ayuda: un contacto anónimo en una red profesional amenazó a su familia si no abría la solicitud. Ha guardado los mensajes y tiene miedo.",
        "offset_minutes": 50,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-10",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Recursos humanos",
          "Seguridad física",
          "Legal"
        ],
        "delivery_method": "in_person",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "Este inject puede incomodar. Mantén la conversación en el procedimiento y el apoyo, no en la culpa.",
        "objective_codes": [
          "OBJ-03"
        ],
        "expected_actions": [
          {
            "code": "INJ-07-A1",
            "description": "Acuerda medidas de seguridad personal para el empleado y su familia.",
            "responsible_role": "Seguridad física",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-03"
            ]
          },
          {
            "code": "INJ-07-A2",
            "description": "Informa a la policía y conserva los mensajes y los registros del cambio.",
            "responsible_role": "Legal",
            "expected_within_minutes": 12,
            "objective_codes": [
              "OBJ-03"
            ]
          },
          {
            "code": "INJ-07-A3",
            "description": "Limita quién lo sabe y decide cómo se apoya al empleado.",
            "responsible_role": "Recursos humanos",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-03"
            ]
          }
        ],
        "images": [],
        "room_codes": [
          "RM-02"
        ],
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
        "code": "INJ-08",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "Un fallo crítico en los controladores de línea",
        "content": "El CSIRT nacional avisa de una vulnerabilidad crítica explotable en remoto en una familia de controladores de automatización, ya explotada donde los equipos están expuestos. La mayoría de las celdas de producción de {organization} la usan. Cada actualización obliga a parar la celda, dejarla segura y validarla, así que el despliegue completo llevaría muchas semanas salvo que se añada gente, con más coste y más riesgo de errores.",
        "offset_minutes": 66,
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
          "Seguridad OT",
          "Dirección de planta"
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
            "code": "INJ-08-A1",
            "description": "Ordena las celdas por exposición, seguridad y peso en producción.",
            "responsible_role": "Seguridad OT",
            "expected_within_minutes": 12,
            "objective_codes": [
              "OBJ-02"
            ]
          },
          {
            "code": "INJ-08-A2",
            "description": "Decide el ritmo de parcheo y los controles para las celdas sin parchear.",
            "responsible_role": "Dirección de planta",
            "expected_within_minutes": 18,
            "objective_codes": [
              "OBJ-02"
            ]
          }
        ],
        "images": [],
        "room_codes": [
          "RM-01"
        ],
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
        "code": "INJ-09",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "Malware con muchos módulos y datos confidenciales fuera",
        "content": "El equipo forense informa de un malware con múltiples módulos: persistencia, captura de tráfico, robo de credenciales, movimiento lateral y denegación de servicio contra protocolos de automatización. El servidor veía el tráfico de las redes de montaje y de pruebas de fin de línea. Han salido varios gigabytes hacia {country_1}: arquitectura de líneas, recetas de automatización, propiedad intelectual, contratos con proveedores y datos identificativos y de pago de clientes.",
        "offset_minutes": 68,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-04",
        "attack_attribution": "threat_actor",
        "threat_actor_code": "THR-01",
        "recipients": [
          "Operaciones de seguridad",
          "Sistemas de fabricación",
          "Legal"
        ],
        "delivery_method": "briefing",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0010",
            "technique_id": "T1041"
          }
        ],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-02",
          "OBJ-05"
        ],
        "expected_actions": [
          {
            "code": "INJ-09-A1",
            "description": "Busca los mismos artefactos en las redes de TI y de planta.",
            "responsible_role": "Sistemas de fabricación",
            "expected_within_minutes": 12,
            "objective_codes": [
              "OBJ-02"
            ]
          },
          {
            "code": "INJ-09-A2",
            "description": "Inicia la evaluación de la brecha con el delegado de protección de datos.",
            "responsible_role": "Legal",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-05"
            ]
          }
        ],
        "images": [],
        "room_codes": [
          "RM-02"
        ],
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
        "code": "INJ-10",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "Firmware alterado: fue un ataque",
        "content": "El análisis forense de las celdas dañadas encuentra firmware no autorizado que cambió los límites de posición y par a los que actúa la parada de seguridad. El daño fue un ciberataque. Hay hashes y una regla de detección listos para compartir.",
        "offset_minutes": 82,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-04",
        "attack_attribution": "threat_actor",
        "threat_actor_code": "THR-01",
        "recipients": [
          "Seguridad OT",
          "Dirección de planta",
          "Responsable del incidente"
        ],
        "delivery_method": "briefing",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "ics",
            "tactic_id": "TA0106",
            "technique_id": "T0836"
          }
        ],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-02"
        ],
        "expected_actions": [
          {
            "code": "INJ-10-A1",
            "description": "Clasifica el suceso como ataque confirmado y lo escala.",
            "responsible_role": "Responsable del incidente",
            "expected_within_minutes": 8,
            "objective_codes": [
              "OBJ-02"
            ]
          },
          {
            "code": "INJ-10-A2",
            "description": "Revisa el resto de celdas con los hashes antes de rearrancar.",
            "responsible_role": "Seguridad OT",
            "expected_within_minutes": 12,
            "objective_codes": [
              "OBJ-02"
            ]
          }
        ],
        "images": [],
        "room_codes": [
          "RM-01"
        ],
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
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "Paga o enseñamos cómo lo hicimos",
        "content": "El consejero delegado recibe un correo: el remitente dice controlar la infraestructura de montaje y todo lo sacado de la red de fabricación, y adjunta un breve vídeo de una pantalla de control de robots. Una página de filtraciones muestra una cuenta atrás de 18 horas y una exigencia de {ransom_amount} en criptomonedas. El proveedor de inteligencia lo vincula a los dos incidentes.",
        "offset_minutes": 100,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-07",
        "attack_attribution": "threat_actor",
        "threat_actor_code": "THR-01",
        "recipients": [
          "Consejero delegado",
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
        "facilitator_notes": "A partir de aquí, proyecta cada inject en la sala principal con todos juntos.",
        "objective_codes": [
          "OBJ-04"
        ],
        "expected_actions": [
          {
            "code": "INJ-11-A1",
            "description": "Nombra quién tiene la decisión y quién habla con la policía y la aseguradora.",
            "responsible_role": "Comité de crisis",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-04"
            ]
          },
          {
            "code": "INJ-11-A2",
            "description": "Revisa sanciones, notificación y límites de divulgación ante cualquier contacto.",
            "responsible_role": "Legal",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-04"
            ]
          }
        ],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": {
          "kind": "email",
          "sender": "Remitente desconocido",
          "sender_address": "proof@mailbox.example.net",
          "recipient": "Consejero delegado",
          "subject": "Hemos estado en tu línea",
          "timestamp": "Día 12, 11:00",
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
        "code": "POL-12",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "La cuenta atrás",
        "content": "Quedan dieciocho horas.",
        "offset_minutes": 110,
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
        "poll_question": "La cuenta atrás corre y el actor tiene datos auténticos. ¿Qué haces?",
        "poll_options": [
          "Rechazar todo contacto y prepararse para la publicación",
          "Abrir un canal mediante especialistas para ganar tiempo, sin prometer el pago",
          "Pagar para detener la publicación",
          "Hacerlo público antes de que lo haga el actor"
        ],
        "poll_outcomes": [
          "Una línea clara que la policía y casi todas las aseguradoras valoran. Los datos salen cuando quiere el actor, y hace falta tener todo preparado.",
          "Ganas horas y sabes qué tiene realmente el actor. Plantilla y reguladores pueden leerlo como negociar, y el canal debe gestionarse con todo rigor.",
          "Puede retrasar la publicación, pero nada lo garantiza. Sanciones, seguro y consejo se vuelven un problema, y pasas a ser un objetivo que paga.",
          "Controlas la historia un día. Anuncias con datos incompletos, y cada corrección posterior contará en tu contra."
        ],
        "poll_impacts": [
          {
            "m1": 1,
            "m2": 2,
            "m3": 2,
            "m4": 2
          },
          {
            "m1": 1,
            "m2": 2,
            "m3": 3,
            "m4": 2,
            "m5": 1
          },
          {
            "m2": 3,
            "m3": 2,
            "m4": 3,
            "m5": 3
          },
          {
            "m1": 1,
            "m2": 2,
            "m3": 3,
            "m4": 2,
            "m5": 1
          }
        ]
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-13",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "La policía convoca una reunión sectorial",
        "content": "La policía nacional confirma que la misma campaña ha afectado a otros fabricantes y proveedores, e invita a {organization} a una reunión cerrada con homólogos y una firma externa de respuesta. Pregunta quién asistirá y qué vais a compartir.",
        "offset_minutes": 118,
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
          "CISO",
          "Legal",
          "Comité de crisis"
        ],
        "delivery_method": "phone",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-04"
        ],
        "expected_actions": [
          {
            "code": "INJ-13-A1",
            "description": "Nombra al representante y acuerda qué información se puede compartir.",
            "responsible_role": "CISO",
            "expected_within_minutes": 10,
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
        "code": "INJ-14",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "Documentos auténticos y falsos, juntos",
        "content": "Termina la cuenta atrás y aparecen archivos en el sitio de filtraciones. Muchos son documentos robados auténticos. Mezclados con ellos hay falsificaciones que dicen que {organization} ocultó defectos de seguridad, manipuló pruebas de calidad y sobornó a funcionarios. Los auténticos hacen creíbles los falsos.",
        "offset_minutes": 126,
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
          "Legal",
          "Comité de crisis",
          "Operaciones de seguridad"
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
            "code": "INJ-14-A1",
            "description": "Acuerda un método para distinguir documentos auténticos y falsos y conserva todas las copias.",
            "responsible_role": "Legal",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-05"
            ]
          },
          {
            "code": "INJ-14-A2",
            "description": "Avisa a las audiencias clave de que se usan datos reales para respaldar afirmaciones falsas.",
            "responsible_role": "Comunicación",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-05"
            ]
          },
          {
            "code": "INJ-14-A3",
            "description": "Confirma con el delegado de protección de datos la decisión sobre la brecha.",
            "responsible_role": "Responsable del incidente",
            "expected_within_minutes": 15,
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
        "code": "INJ-15",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "La historia corre por las redes",
        "content": "FILTRADO: documentos internos demuestran que {organization} conocía defectos de seguridad y pagó para ocultarlos. Comparte antes de que lo borren.",
        "offset_minutes": 134,
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
          "Comunicación",
          "Consejero delegado"
        ],
        "delivery_method": "media",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-05"
        ],
        "expected_actions": [
          {
            "code": "INJ-15-A1",
            "description": "Aprueba hechos verificados, un portavoz y qué falsedades corregir primero.",
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
          "kind": "social_post",
          "sender": "Cuenta de noticias del motor",
          "sender_address": "@motor_leaks",
          "recipient": "",
          "subject": "",
          "timestamp": "Día 13, 11:00",
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
        "code": "INJ-16",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "Las acciones caen",
        "content": "Las acciones han perdido casi una cuarta parte de su valor desde la divulgación, y grandes inversores hacen preguntas. La presidencia del consejo quiere saber qué se puede decir al mercado y quién lo firma.",
        "offset_minutes": 142,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-11",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Consejero delegado",
          "Relación con inversores",
          "Legal"
        ],
        "delivery_method": "phone",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-05"
        ],
        "expected_actions": [
          {
            "code": "INJ-16-A1",
            "description": "Prepara con Legal una actualización factual sobre producción, datos y recuperación.",
            "responsible_role": "Relación con inversores",
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
        "code": "DSC-17",
        "phase_code": "PH-04",
        "kind": "mandatory",
        "title": "Cerrar la crisis",
        "content": "Los servicios están casi restaurados y no han aparecido nuevos activos comprometidos. Un informe independiente ha separado los documentos auténticos de los falsos. ¿Qué debe terminarse antes de disolver el comité de crisis y cómo sigue la supervisión después?",
        "offset_minutes": 155,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-11",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Consejero delegado",
          "Comité de crisis"
        ],
        "delivery_method": "in_person",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "Pregunta por el riesgo residual, las notificaciones abiertas, las celdas sin parchear y el seguimiento del empleado coaccionado.",
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
        "code": "DSC-18",
        "phase_code": "PH-04",
        "kind": "mandatory",
        "title": "Lecciones de dos salas",
        "content": "Dos equipos trabajaron contra el mismo adversario durante días sin saberlo. ¿Cuándo pudieron conectar los hechos, qué habría cambiado y quién se encarga de las mejoras en acceso de proveedores, control de cambios y monitorización de planta?",
        "offset_minutes": 168,
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
          "CISO",
          "Comité de crisis",
          "Dirección de planta"
        ],
        "delivery_method": "briefing",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "Anota cada mejora con responsable y fecha para el informe posterior.",
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
      }
    ],
    "next_phase_number": 5,
    "next_inject_number": 19,
    "next_threat_actor_number": 2,
    "meters": [
      {
        "key": "m1",
        "name": "Producción"
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
      "origin_id": "cybersecurity-team-member",
      "origin_name": "Miembro del equipo de ciberseguridad",
      "code": "ACT-03",
      "name": "Miembro del equipo de ciberseguridad",
      "type": "internal",
      "description": "Un analista o ingeniero que informa de lo que muestra una herramienta de seguridad, cuando el equipo de ciberseguridad no juega.",
      "channel": "security_tool"
    },
    {
      "origin": "system",
      "origin_id": "dfir-provider",
      "origin_name": "Proveedor de respuesta a incidentes (retainer)",
      "code": "ACT-04",
      "name": "Proveedor de respuesta a incidentes (retainer)",
      "type": "supplier",
      "description": "El equipo externo de respuesta y forense, normalmente con un contrato (retainer) que se activa durante el incidente: hallazgos, informes y recomendaciones de contención.",
      "channel": "briefing"
    },
    {
      "origin": "system",
      "origin_id": "national-csirt",
      "origin_name": "CSIRT nacional",
      "code": "ACT-05",
      "name": "CSIRT nacional",
      "type": "csirt",
      "description": "El equipo nacional de respuesta a incidentes: pide notificaciones y comparte indicadores.",
      "channel": "email"
    },
    {
      "origin": "system",
      "origin_id": "police-cybercrime",
      "origin_name": "Unidad de delitos informáticos",
      "code": "ACT-06",
      "name": "Unidad de delitos informáticos",
      "type": "authority",
      "description": "Las fuerzas de seguridad que investigan el ataque y piden evidencias.",
      "channel": "phone"
    },
    {
      "origin": "system",
      "origin_id": "threat-actor",
      "origin_name": "Atacante (remitente)",
      "code": "ACT-07",
      "name": "Atacante (remitente)",
      "type": "threat_actor",
      "description": "Firma los mensajes del atacante: notas de rescate, publicaciones de filtraciones, plazos. Quién es el atacante, y sus técnicas, son los actores de amenaza del escenario.",
      "channel": "document"
    },
    {
      "origin": "system",
      "origin_id": "threat-intel-provider",
      "origin_name": "Proveedor de inteligencia de amenazas",
      "code": "ACT-08",
      "name": "Proveedor de inteligencia de amenazas",
      "type": "supplier",
      "description": "Vigila foros, sitios de filtraciones y redes: avisa de datos expuestos y de la actividad del atacante.",
      "channel": "email"
    },
    {
      "origin": "system",
      "origin_id": "media",
      "origin_name": "Medios de comunicación",
      "code": "ACT-09",
      "name": "Medios de comunicación",
      "type": "media",
      "description": "Periodistas que preguntan o publican sobre el incidente.",
      "channel": "media"
    },
    {
      "origin": "system",
      "origin_id": "insider",
      "origin_name": "Empleado",
      "code": "ACT-10",
      "name": "Empleado",
      "type": "internal",
      "description": "Un empleado que avisa de algo extraño, o el insider que está detrás.",
      "channel": "in_person"
    },
    {
      "origin": "system",
      "origin_id": "board-chair",
      "origin_name": "Presidencia del consejo",
      "code": "ACT-11",
      "name": "Presidencia del consejo",
      "type": "internal",
      "description": "La presidencia del consejo de administración cuando el consejo no juega: pide explicaciones y convoca sesiones.",
      "channel": "phone"
    }
  ],
  "next_actor_number": 12,
  "tags": [
    {
      "origin": "system",
      "origin_id": "ot-ics",
      "origin_name": "OT / ICS",
      "name": "OT / ICS",
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
      "origin_id": "insider",
      "origin_name": "Amenaza interna",
      "name": "Amenaza interna",
      "color": "rose",
      "custom_hex": null,
      "applied": true
    },
    {
      "origin": "system",
      "origin_id": "hybrid",
      "origin_name": "Amenaza híbrida",
      "name": "Amenaza híbrida",
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
      "origin_id": "nis2",
      "origin_name": "NIS2",
      "name": "NIS2",
      "color": "slate",
      "custom_hex": null,
      "applied": true
    }
  ],
  "images": [],
  "uses_rooms": true,
  "rooms": [
    {
      "code": "RM-01",
      "name": "Planta y proveedor",
      "description": "Dirección de planta, seguridad OT y compras."
    },
    {
      "code": "RM-02",
      "name": "Sistemas de fabricación",
      "description": "Operaciones de seguridad, sistemas de fabricación, recursos humanos y seguridad física."
    }
  ],
  "next_room_number": 3,
  "files": []
}
```
