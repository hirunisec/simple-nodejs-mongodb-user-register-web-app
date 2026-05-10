pipeline {
    agent any

    environment {
        APP_NAME = 'user-crud-app'
        IMAGE_NAME = 'user-crud-app'
        APP_VERSION = "1.0.${BUILD_NUMBER}"

        STAGING_URL = 'http://host.docker.internal:5501/health'
        PROD_URL = 'http://host.docker.internal:5502/health'
        PROMETHEUS_URL = 'http://host.docker.internal:9090/-/ready'

        SONARQUBE_ENV = 'SonarQubeServer'
        SONAR_SCANNER = 'SonarScanner'

        TEST_DB_URL = 'mongodb://host.docker.internal:27017/user_register_test'
    }

    options {
        timestamps()
        buildDiscarder(logRotator(numToKeepStr: '10'))
        disableConcurrentBuilds()
    }

    stages {
        stage('Checkout') {
            steps {
                echo 'Checking out source code from GitHub...'
                checkout scm

                sh 'git rev-parse --short HEAD > git_commit.txt'

                script {
                    env.GIT_SHORT_COMMIT = readFile('git_commit.txt').trim()
                }

                echo "Git commit: ${env.GIT_SHORT_COMMIT}"
            }
        }

        stage('Install Dependencies') {
            steps {
                echo 'Installing Node.js dependencies...'
                sh 'npm ci'
            }
        }

        stage('Build') {
            steps {
                echo 'Building Docker image as the deployment artefact...'

                sh '''
                    docker build \
                    -t ${IMAGE_NAME}:${APP_VERSION} \
                    -t ${IMAGE_NAME}:latest .
                '''
            }
        }

        stage('Test') {
            steps {
                echo 'Starting MongoDB for automated tests...'

                sh '''
                    docker start mongodb-hd || docker run -d --name mongodb-hd -p 27017:27017 mongo:7
                    sleep 10
                    export DB_URL=${TEST_DB_URL}
                    npm run test:ci
                '''
            }

            post {
                always {
                    echo 'Archiving test results and coverage reports...'
                    junit allowEmptyResults: true, testResults: 'junit.xml'
                    archiveArtifacts artifacts: 'coverage/**', allowEmptyArchive: true
                }
            }
        }

        stage('Code Quality') {
            steps {
                echo 'Running SonarQube code quality analysis...'

                script {
                    def scannerHome = tool "${SONAR_SCANNER}"

                    withSonarQubeEnv("${SONARQUBE_ENV}") {
                        sh """
                            ${scannerHome}/bin/sonar-scanner \
                            -Dsonar.projectVersion=${APP_VERSION}
                        """
                    }
                }
            }
        }

        stage('Security') {
            steps {
                echo 'Running Trivy filesystem and Docker image security scans...'

                sh '''
                    mkdir -p security-reports

                    trivy fs \
                    --format table \
                    --output security-reports/trivy-fs-report.txt \
                    --severity HIGH,CRITICAL \
                    --exit-code 0 .

                    trivy image \
                    --format table \
                    --output security-reports/trivy-image-report.txt \
                    --severity HIGH,CRITICAL \
                    --exit-code 0 \
                    ${IMAGE_NAME}:${APP_VERSION}
                '''
            }

            post {
                always {
                    archiveArtifacts artifacts: 'security-reports/**', allowEmptyArchive: true
                }
            }
        }

        stage('Deploy to Staging') {
            steps {
                echo 'Deploying application to staging environment using Docker Compose...'

                sh '''
                    export APP_VERSION=${APP_VERSION}
                    docker compose up -d mongo
                    docker compose up -d app-staging
                    docker ps
                '''
            }
        }

        stage('Staging Smoke Test') {
            steps {
                echo 'Checking whether staging deployment is healthy...'

                sh '''
                    sleep 15
                    curl -f ${STAGING_URL}
                '''
            }
        }

        stage('Release to Production') {
            steps {
                echo 'Promoting the tested Docker image to production...'

                sh '''
                    export APP_VERSION=${APP_VERSION}
                    docker compose up -d app-prod
                    docker compose up -d --build prometheus
                    docker ps
                '''
            }
        }

        stage('Production Smoke Test') {
            steps {
                echo 'Checking whether production release is healthy...'

                sh '''
                    sleep 15
                    curl -f ${PROD_URL}
                '''
            }
        }

        stage('Monitoring and Alerting') {
            steps {
                echo 'Validating production monitoring endpoints and Prometheus readiness...'

                sh '''
                    mkdir -p monitoring-reports

                    curl -f http://host.docker.internal:5502/health | tee monitoring-reports/health-check.txt
                    curl -f http://host.docker.internal:5502/metrics | head -30 | tee monitoring-reports/metrics-sample.txt
                    curl -f ${PROMETHEUS_URL} | tee monitoring-reports/prometheus-ready.txt
                '''
            }

            post {
                always {
                    archiveArtifacts artifacts: 'monitoring-reports/**', allowEmptyArchive: true
                }
            }
        }

        stage('Archive Build Artefacts') {
            steps {
                echo 'Archiving build metadata and reports...'

                sh '''
                    mkdir -p build-info

                    echo "Application: ${APP_NAME}" > build-info/build-summary.txt
                    echo "Version: ${APP_VERSION}" >> build-info/build-summary.txt
                    echo "Git Commit: ${GIT_SHORT_COMMIT}" >> build-info/build-summary.txt
                    echo "Build Number: ${BUILD_NUMBER}" >> build-info/build-summary.txt
                    echo "Docker Image: ${IMAGE_NAME}:${APP_VERSION}" >> build-info/build-summary.txt
                    echo "Staging URL: http://localhost:5501" >> build-info/build-summary.txt
                    echo "Production URL: http://localhost:5502" >> build-info/build-summary.txt
                    echo "Prometheus URL: http://localhost:9090" >> build-info/build-summary.txt
                '''

                archiveArtifacts artifacts: 'build-info/**, security-reports/**, monitoring-reports/**, coverage/**', allowEmptyArchive: true
            }
        }
    }

    post {
        success {
            echo "Pipeline completed successfully. Version ${APP_VERSION} is deployed to production."
        }

        failure {
            echo 'Pipeline failed. Review the failed stage logs.'
            sh 'docker ps || true'
        }

        always {
            echo 'Pipeline finished. Displaying running containers.'
            sh 'docker ps || true'
        }
    }
}