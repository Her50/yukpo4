use axum::{body::Body, http::{Request, StatusCode}, response::Response};
use futures::FutureExt; // for catch_unwind
use serde_json::json;
use std::{future::Future, pin::Pin, task::{Context, Poll}};
use tower::{Layer, Service};

#[derive(Clone, Copy)]
pub struct CatchUnwindLayer;

impl<S> Layer<S> for CatchUnwindLayer {
    type Service = CatchUnwindMiddleware<S>;
    fn layer(&self, inner: S) -> Self::Service {
        CatchUnwindMiddleware { inner }
    }
}

#[derive(Clone, Copy)]
pub struct CatchUnwindMiddleware<S> {
    inner: S,
}

impl<S, ReqBody> Service<Request<ReqBody>> for CatchUnwindMiddleware<S>
where
    S: Service<Request<ReqBody>, Response = Response, Error = axum::BoxError> + Clone + Send + 'static,
    S::Future: Send + 'static,
    ReqBody: Send + 'static,
{
    type Response = Response;
    type Error = axum::BoxError;
    type Future = Pin<Box<dyn Future<Output = Result<Self::Response, Self::Error>> + Send>>;

    fn poll_ready(&mut self, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        self.inner.poll_ready(cx)
    }

    fn call(&mut self, req: Request<ReqBody>) -> Self::Future {
        let mut inner = self.inner.clone();
        let fut = inner.call(req);
        let fut = std::panic::AssertUnwindSafe(fut).catch_unwind();
        Box::pin(async move {
            match fut.await {
                Ok(Ok(resp)) => Ok(resp),
                Ok(Err(e)) => Err(e),
                Err(panic) => {
                    let err_msg = if let Some(s) = panic.downcast_ref::<&str>() {
                        s.to_string()
                    } else if let Some(s) = panic.downcast_ref::<String>() {
                        s.clone()
                    } else {
                        "panic".to_string()
                    };
                    let body = Body::from(
                        serde_json::to_string(&json!({
                            "error": "Internal server error (panic)",
                            "details": err_msg
                        })).unwrap()
                    );
                    let mut resp = Response::new(body);
                    *resp.status_mut() = StatusCode::INTERNAL_SERVER_ERROR;
                    Ok(resp)
                }
            }
        })
    }
}

pub async fn catch_unwind_handler(
    req: Request<Body>,
    next: axum::middleware::Next,
) -> Response {
    eprintln!("[DEBUG] catch_unwind_handler appel?");
    match std::panic::AssertUnwindSafe(next.run(req)).catch_unwind().await {
        Ok(resp) => resp,
        Err(e) => {
            let err_msg = if let Some(s) = e.downcast_ref::<&str>() {
                s.to_string()
            } else if let Some(s) = e.downcast_ref::<String>() {
                s.clone()
            } else {
                "panic".to_string()
            };
            let body = Body::from(
                serde_json::to_string(&json!({
                    "error": "Internal server error (panic)",
                    "details": err_msg
                })).unwrap()
            );
            let mut resp = Response::new(body);
            *resp.status_mut() = StatusCode::INTERNAL_SERVER_ERROR;
            resp
        }
    }
}
