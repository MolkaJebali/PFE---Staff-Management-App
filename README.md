<div align="center">

<img src="https://img.shields.io/badge/Angular-18-DD0031?style=for-the-badge&logo=angular&logoColor=white"/>
<img src="https://img.shields.io/badge/Spring_Boot-3-6DB33F?style=for-the-badge&logo=springboot&logoColor=white"/>
<img src="https://img.shields.io/badge/SQL_Server-CC2927?style=for-the-badge&logo=microsoftsqlserver&logoColor=white"/>
<img src="https://img.shields.io/badge/Power_BI-F2C811?style=for-the-badge&logo=powerbi&logoColor=black"/>
<img src="https://img.shields.io/badge/XGBoost-ML-3498DB?style=for-the-badge&logo=python&logoColor=white"/>
<img src="https://img.shields.io/badge/JWT-Auth-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white"/>

# 🐝 BeeGrowth — Staff Management & Performance Piloting Platform

> **End-of-Degree Project (PFE) — Licence · Mention Très Bien**
> Biware Consulting · Tunis, Tunisia · February – June 2025

A full-stack intelligent staffing platform combining a **dimensional Data Warehouse**, **ETL pipelines**, **Power BI Embedded dashboards**, and an **XGBoost-powered task-effort prediction chatbot** — all exposed through a modern Angular / Spring Boot application secured with JWT.

</div>

---

## 📑 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Data & BI Layer](#-data--bi-layer)
- [Machine Learning](#-machine-learning)
- [Frontend — Angular 18](#-frontend--angular-18)
- [Backend — Spring Boot](#-backend--spring-boot)
- [Getting Started](#-getting-started)
- [Project Structure](#-project-structure)
- [Authors](#-authors)

---

## 🔭 Overview

**BeeGrowth** was designed and built in a pair during a 5-month internship at **Biware Consulting** to address the company's need for a centralised, data-driven staffing management system. The platform covers the full analytical lifecycle:

1. **Data ingestion** from Excel files and the operational database via SSIS ETL pipelines.
2. **Storage** in a 3-layer dimensional Data Warehouse hosted on SQL Server.
3. **Reporting** through interactive Power BI dashboards embedded directly into the application.
4. **Prediction** of task effort using a fine-tuned XGBoost regression model exposed through a conversational AI chatbot.
5. **Management** of employees, tasks, assignments and performance tracking through a role-based Angular front-end backed by a Spring Boot REST API.

---

## ✨ Key Features

| Feature | Description |
|---|---|
| 🔐 **JWT Authentication** | Secure login with role-based access (Manager, Assistant Manager, Employee) |
| 👥 **Employee Management** | Full CRUD for staff profiles, contracts and skills |
| 📋 **Task Tracking** | Plan, assign and follow up on tasks with real-time status updates |
| 📊 **Power BI Embedded** | 3 embedded dashboards with 22 DAX measures directly in the app |
| 🤖 **AI Chatbot** | XGBoost-backed effort prediction assistant integrated in the UI |
| 📡 **Real-time Notifications** | WebSocket (STOMP/SockJS) push notifications |
| 📄 **Export** | PDF & Excel report generation (jsPDF + xlsx) |
| 🌐 **Internationalisation** | Multi-language support via ngx-translate |
| 🔔 **Manager Suivi** | Supervisor follow-up view with deviation tracking (planned vs. actual) |

---

## 🏛️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        DATA SOURCES                             │
│          Excel Files          │    Operational DB (SQL Server)  │
└───────────────┬───────────────┴──────────────┬──────────────────┘
                │         SSIS ETL Pipelines    │
                ▼                              ▼
┌─────────────────────────────────────────────────────────────────┐
│               DATA WAREHOUSE  (3-layer · SQL Server)            │
│   Staging Layer → Integration Layer → Presentation Layer        │
│                                                                 │
│   Fact Table: FACT_TASK_PERFORMANCE                             │
│   Dimensions: DIM_EMPLOYEE · DIM_PROJECT · DIM_DATE · DIM_TASK │
└──────────────────────────┬──────────────────────────────────────┘
                           │
          ┌────────────────┼───────────────────────┐
          ▼                ▼                       ▼
   Power BI Service   Python / ML             Spring Boot API
   (3 dashboards,     (XGBoost model,          (REST · JWT)
    22 DAX measures)   MAE 2.14 h, R²=0.54)        │
          │                │                        │
          └────────────────┴────────────────────────┘
                                    │
                            Angular 18 SPA
                      (SSR · TailwindCSS · Flowbite)
```

---

## 🛠️ Tech Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| Angular | 18 | SPA framework with SSR |
| TailwindCSS | 3 | Utility-first CSS |
| Flowbite | 3 | UI component library |
| ngx-translate | 16 | i18n |
| ngx-toastr | 19 | Toast notifications |
| STOMP / SockJS | — | WebSocket real-time comms |
| jsPDF + html2canvas | — | PDF export |
| xlsx / file-saver | — | Excel export |
| Font Awesome | 6 | Icon set |

### Backend (Spring Boot)
| Technology | Purpose |
|---|---|
| Spring Boot 3 | REST API |
| Spring Security + JWT | Authentication & authorisation |
| Spring Data JPA | ORM / database access |
| WebSocket (STOMP) | Real-time notifications |
| SQL Server | Operational database |

### Data & Analytics
| Technology | Purpose |
|---|---|
| SQL Server | Data Warehouse + operational DB |
| SSIS | ETL pipelines (Excel → DWH, AppDB → DWH) |
| Power BI + DAX | Dashboards & KPI measures |
| Power BI Embedded | Embedding reports in the app |

### Machine Learning
| Technology | Purpose |
|---|---|
| Python | Model training & evaluation |
| XGBoost | Task effort prediction (selected model) |
| scikit-learn | Preprocessing & model comparison |
| pandas / numpy | Data engineering |

---

## 📊 Data & BI Layer

### Data Warehouse

The DWH follows a **star schema** design deployed on SQL Server, structured in **3 layers**:

- **Staging** — raw data loaded as-is from sources
- **Integration** — cleaned, validated and conformed data
- **Presentation** — dimensional model ready for reporting

**Schema:**

```
                        ┌──────────────┐
                        │  DIM_DATE    │
                        └──────┬───────┘
 ┌──────────────┐              │              ┌──────────────┐
 │ DIM_EMPLOYEE ├──────── FACT_TASK ──────────┤  DIM_PROJECT │
 └──────────────┘      PERFORMANCE            └──────────────┘
                              │
               ┌──────────────┘
               │
          ┌────┴─────────┐
          │   DIM_TASK   │
          └──────────────┘
```

### Power BI Dashboards & DAX Measures

| Dashboard | Key Measures |
|---|---|
| **Performance Dashboard** | Completion rate, tasks on time vs. late, effort variance |
| **Staffing Dashboard** | Resource allocation, workload distribution, availability |
| **Manager Follow-up** | Planned vs. actual effort, deviation %, late task count |

**22 DAX measures** include: `Taux de complétion`, `Écart planifié/réalisé`, `Tâches en retard`, `Charge moyenne`, and more.

---

## 🤖 Machine Learning

### Task Effort Prediction

Six regression models were trained and evaluated on historical task data to predict the **effort (hours)** required for a task:

| Model | MAE (h) | R² |
|---|---|---|
| Linear Regression | — | — |
| Ridge / Lasso | — | — |
| Random Forest | — | — |
| Gradient Boosting | — | — |
| **XGBoost (selected ✅)** | **2.14** | **0.54** |
| SVR | — | — |

The **XGBoost** model was selected for its best balance of accuracy and robustness. It was:
- Fine-tuned with **GridSearchCV**
- Integrated into the Spring Boot backend via a REST microservice
- Exposed to end-users through an **AI chatbot** embedded in the Angular application

---

## 🅰️ Frontend — Angular 18

### Application Roles & Routes

| Role | Available Routes |
|---|---|
| **Manager** | `/manager-home`, `/dashboard`, `/employee`, `/manager-suivi`, `/manager-sheet`, `/contact` |
| **Assistant Manager** | `/assistant-manager`, `/dashboard`, `/contact` |
| **Employee** | `/employee-home`, `/contact` |

### Notable Modules

```
src/app/
├── login/                  # Authentication (JWT)
├── sign-in/                # Registration
├── HomePage/               # Manager home dashboard
├── DashboardPage/          # Power BI Embedded dashboards
├── employee/               # Employee management
├── employee-home/          # Employee personal view
├── manager-suivi/          # Manager follow-up & tracking
├── manager-sheet/          # Timesheet management
├── assistant-manager/      # Assistant manager workspace
├── ml/                     # AI chatbot & prediction UI
├── notification/           # Real-time notifications
├── services/               # HTTP, ML prediction, notification services
├── interceptors/           # JWT HTTP interceptor
├── models/                 # TypeScript DTOs & interfaces
└── shared/                 # Shared components & utilities
```

---

## ☕ Backend — Spring Boot

The backend exposes a secured REST API with the following main capabilities:

- **User management** — registration, login, role management
- **Employee & project CRUD** — full lifecycle management
- **Task management** — creation, assignment, status tracking, deadline alerts
- **Timesheet management** — effort logging and sheet validation
- **ML prediction endpoint** — serves XGBoost predictions on demand
- **WebSocket broker** — broadcasts real-time notifications to connected clients
- **Power BI token service** — generates embed tokens for secure dashboard embedding

---

## 🚀 Getting Started

### Prerequisites

| Tool | Minimum Version |
|---|---|
| Node.js | 18+ |
| npm | 9+ |
| Angular CLI | 18 |
| Java JDK | 17+ |
| SQL Server | 2019+ |
| Python | 3.10+ |

### Frontend Setup

```bash
# Clone the repository
git clone https://github.com/MolkaJebali/PFE---Staff-Management-App.git
cd PFE---Staff-Management-App

# Install dependencies
npm install

# Start the development server
npm start
# → http://localhost:4200
```

### Environment Configuration

Update `src/environments/environment.ts` with your backend API URL:

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8080/api',
  powerBiEmbedUrl: 'YOUR_POWER_BI_EMBED_URL'
};
```

### Backend Setup

```bash
# Navigate to the Spring Boot project
cd backend/

# Configure database in application.properties
# Run the application
mvn spring-boot:run
# → http://localhost:8080
```

### ETL Pipelines

The SSIS packages are located in the `/etl` directory. Deploy them on SQL Server Integration Services and configure the connection managers to point to your SQL Server instance.

---

## 📁 Project Structure

```
PFE---Staff-Management-App/
│
├── 📂 src/                        # Angular 18 frontend
│   ├── app/                       # Feature modules & components
│   ├── environments/              # Environment configs
│   └── styles.css                 # Global styles
│
├── 📂 backend/                    # Spring Boot REST API
│   └── src/main/java/...
│
├── 📂 ml/                         # Python ML scripts & model
│   ├── training/                  # Model training notebooks
│   └── model/                     # Serialised XGBoost model
│
├── 📂 etl/                        # SSIS ETL packages
│   ├── staging/
│   ├── integration/
│   └── presentation/
│
├── 📂 powerbi/                    # Power BI report files (.pbix)
│
├── angular.json
├── package.json
├── tailwind.config.js
└── README.md
```

---

## 🏢 About the Internship

| | |
|---|---|
| **Company** | Biware Consulting |
| **Location** | Tunis, Tunisia (Remote) |
| **Period** | February 2025 – June 2025 |
| **Type** | End-of-Degree Internship (PFE de Licence) |
| **Result** | **Mention Très Bien** 🏅 |

---

<div align="center">

Made with ❤️ by Molka Jebali & Dina Ben Hassine · Biware Consulting 2025

</div>
