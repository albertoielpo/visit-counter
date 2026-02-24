pipeline {
    agent any
    
    environment {
        GIT_BRANCH = "main"
        APP_NAME = "visit-counter"
    }
    
    stages {
        stage('Clone Repository') {
            steps {
                git credentialsId: 'jenkins-ielpo-local', 
                    url: "${GITHUB_ALBERTOIELPO_URL}/${APP_NAME}.git",
                    branch: "${GIT_BRANCH}"
            }
        }
        
        stage('Build') {
            steps {
                sh """
                    docker build -t ${APP_NAME} .
                    docker tag ${APP_NAME}:latest ${DOCKER_REGISTRY}/${APP_NAME}:latest
                """
            }
        }
        
        stage("Push") {
            steps {
                sh """
                    docker push ${DOCKER_REGISTRY}/${APP_NAME}:latest
                """
            }
        }
    }
    
    post {
        always {
            // clean workspace
            cleanWs()
        }
    }
}
